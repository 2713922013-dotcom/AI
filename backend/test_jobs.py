"""
岗位数据层回归测试 —— store.py + jd_parser.py

这些测试守的是「数据可信度」这条线：
真实岗位不能被假数据污染，解析不出来的字段不能靠猜补上。
"""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import jd_parser
import store

PASSED = []
FAILED = []


def check(name, fn):
    try:
        fn()
        PASSED.append(name)
        print(f"test_{name}\n  ✓ {getattr(fn, '_msg', 'ok')}")
    except AssertionError as e:
        FAILED.append(name)
        print(f"test_{name}\n  ✗ {e}")
    except Exception as e:  # noqa: BLE001
        FAILED.append(name)
        print(f"test_{name}\n  ✗ 异常：{type(e).__name__}: {e}")


def _tmp_store():
    fd, path = tempfile.mkstemp(suffix='.db')
    os.close(fd)
    os.unlink(path)
    return store.JobStore(path), path


def test_seed_data_is_clean():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'seed_jobs.json')
    items = json.load(open(path, encoding='utf-8'))
    assert len(items) >= 30, f"种子数据只有 {len(items)} 条"
    for it in items:
        assert it.get('title'), '存在没有岗位名称的种子数据'
        assert it.get('company'), f"{it.get('title')} 缺少公司"
        assert it.get('source_url', '').startswith('http'), f"{it.get('title')} 缺少可核验链接"
        assert it.get('collected_at'), f"{it.get('title')} 缺少采集日期"
        assert it.get('description'), f"{it.get('title')} 缺少岗位描述"
    # 标题+公司+城市不能重复
    fps = {(i['title'], i['company'], i['city']) for i in items}
    assert len(fps) == len(items), '种子数据内部存在重复岗位'
    test_seed_data_is_clean._msg = f"{len(items)} 条种子数据，字段完整、无重复、链接可核验"


def test_seed_and_dedup():
    s, path = _tmp_store()
    try:
        r = s.seed_from_file()
        assert r['loaded'] >= 30, r
        before = s.count()
        # 同标题同公司同城市，薪资不同也应判重
        dup = s.add({'title': '数据分析师', 'company': '厦门和新科技股份有限公司',
                     'city': '厦门', 'salary_min': 99, 'salary_max': 120})
        assert dup['ok'] is False and dup['reason'] == 'duplicate', dup
        assert s.count() == before, '重复岗位被写进了库'
        test_seed_and_dedup._msg = f"{before} 条入库，重复写入被指纹拦截"
    finally:
        s2, _ = None, None


def test_seed_is_protected():
    s, path = _tmp_store()
    s.seed_from_file()
    seed_id = s.all_jobs()[0]['id']
    r = s.delete(seed_id)
    assert r['ok'] is False and r['reason'] == 'protected', r
    assert s.count() > 0
    test_seed_is_protected._msg = '核验岗位拒绝删除'


def test_user_import_roundtrip():
    s, path = _tmp_store()
    s.seed_from_file()
    res = s.add({
        'title': '测试岗', 'company': '某公司', 'city': '上海',
        'skills_required': ['Python', 'Python', 'Go'],
        'salary_min': 20, 'salary_max': 30,
    }, source_type='user_import')
    assert res['ok'] is True, res
    job = s.get(res['id'])
    assert job['skills_required'] == ['Python', 'Go'], job['skills_required']
    assert job['source_type'] == 'user_import'
    assert job['is_stale'] is False
    assert s.delete(res['id'])['ok'] is True
    test_user_import_roundtrip._msg = '导入可写、技能去重、可删除'


def test_stale_detection():
    assert store._is_stale('2020-01-01') is True
    assert store._is_stale('') is True
    assert store._is_stale(None) is True
    from datetime import date
    assert store._is_stale(date.today().isoformat()) is False
    test_stale_detection._msg = '过期岗位能被识别出来'


def test_salary_units():
    cases = [
        ('25-40K·15薪', (25, 40)),
        ('20k-35k', (20, 35)),
        ('30-60万/年', (25, 50)),
        ('1.5-2.5万', (15, 25)),
        ('8000-12000元/月', (8, 12)),
        ('薪资面议', (None, None)),
    ]
    for text, expect in cases:
        got = jd_parser.parse_salary(text)
        assert got == expect, f"{text} -> {got}，期望 {expect}"
    test_salary_units._msg = 'K/万每年/万每月/元每月 四种单位换算正确'


def test_skill_substring_guard():
    # 这是最容易出错的地方：短技能名被长技能名包含
    assert jd_parser.extract_skills('熟悉 JavaScript') == ['JavaScript'], 'JavaScript 被误判成 Java'
    assert 'Java' not in jd_parser.extract_skills('熟悉 JavaScript')
    assert jd_parser.extract_skills('使用 Django') == ['Django'], 'Django 被误判成 Go'
    assert 'Go' not in jd_parser.extract_skills('了解 Google Cloud'), 'Google 被误判成 Go'
    assert 'Go' in jd_parser.extract_skills('有 Golang 经验'), 'Golang 应归一为 Go'
    test_skill_substring_guard._msg = 'JavaScript/Java、Django/Go、Google/Go 均未串味'


def test_jd_rejects_garbage():
    r1 = jd_parser.parse_jd('')
    assert r1['ok'] is False and r1['reason'] == 'empty_text', r1
    r2 = jd_parser.parse_jd('招人')
    assert r2['ok'] is False and r2['reason'] == 'too_short', r2
    test_jd_rejects_garbage._msg = '空内容与过短内容被拒绝并给出原因'


def test_jd_does_not_invent_fields():
    """解析不出来就留空，绝不编造。"""
    r = jd_parser.parse_jd('高级前端工程师\n负责 React 项目开发，熟悉 TypeScript。')
    d = r['data']
    assert d['title'] == '高级前端工程师'
    assert d['company'] == '', f"没有公司信息却填了 {d['company']!r}"
    assert d['salary_min'] is None and d['salary_max'] is None, '没有薪资却填了数字'
    assert 'company' in r['missing_fields']
    assert 'salary' in r['missing_fields']
    test_jd_does_not_invent_fields._msg = '缺失字段留空并登记，未编造公司/薪资'


def test_jd_noise_removed():
    text = '数据分析师\n15-25K\n上海 本科\n1. 熟练 SQL\n举报\n竞争力分析\n相似职位\n查看更多'
    d = jd_parser.parse_jd(text)['data']
    for noise in ('举报', '竞争力分析', '相似职位', '查看更多'):
        assert noise not in d['description'], f'噪音行 {noise} 没被清掉'
    assert '熟练 SQL' in d['description']
    test_jd_noise_removed._msg = '招聘站噪音行被清理，正文保留'


def main():
    print('运行岗位数据层测试\n')
    check('seed_data_is_clean', test_seed_data_is_clean)
    check('seed_and_dedup', test_seed_and_dedup)
    check('seed_is_protected', test_seed_is_protected)
    check('user_import_roundtrip', test_user_import_roundtrip)
    check('stale_detection', test_stale_detection)
    check('salary_units', test_salary_units)
    check('skill_substring_guard', test_skill_substring_guard)
    check('jd_rejects_garbage', test_jd_rejects_garbage)
    check('jd_does_not_invent_fields', test_jd_does_not_invent_fields)
    check('jd_noise_removed', test_jd_noise_removed)

    print(f"\n{len(PASSED)} 通过 / {len(FAILED)} 失败")
    if FAILED:
        print('失败项:', ', '.join(FAILED))
        sys.exit(1)
    print('全部通过')


if __name__ == '__main__':
    main()
