from pathlib import Path
import importlib.util
import sys

from app.scraper import parse_room_page

SCRIPT = Path(__file__).resolve().parents[3] / 'scripts' / 'merge_huya_history.py'
spec = importlib.util.spec_from_file_location('merge_huya_history', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_current_2026_public_render_and_cover():
    html = ('<title>集美小喵【ZKL】官方直播间-户外-虎牙直播</title>'
            '<meta name="keywords" content="集美小喵【ZKL】,户外直播,156324">'
            '<meta name="image" content="//live-cover.msstatic.com/cover.jpg">'
            '<body>关注 3.2万 集美小喵【ZKL】 156324 26.6万 户外</body>')
    data = parse_room_page(html)
    assert data['display_heat'] == '26.6万'
    assert data['followers_display'] == '3.2万'
    assert data['cover_url'] == 'https://live-cover.msstatic.com/cover.jpg'
    assert data['status'] == 'unknown'


def test_cover_domain_is_restricted():
    html = ('<title>集美小喵【ZKL】官方直播间-户外-虎牙直播</title>'
            '<meta name="keywords" content="集美小喵,156324">'
            '<meta name="image" content="https://random.example/foreign.jpg">')
    assert parse_room_page(html)['cover_url'] is None


def test_history_is_bounded_and_deduplicated():
    snapshot = {'room_id': '156324', 'observed_at': '2026-11-16T11:00:00+00:00',
                'display_heat': '26.6万', 'status': 'unknown', 'followers_display': '3.2万'}
    result = module.merge_history(None, snapshot)
    assert result['room_id'] == '156324'
    assert len(result['items']) == 1
    same = module.merge_history(result, snapshot)
    assert len(same['items']) == 1
    past = {'room_id': '156324', 'items': [dict(observed_at=f'2026-11-{day:02d}T00:00:00Z',
                                        display_heat='20万') for day in range(1,16)]}
    new = module.merge_history(past, snapshot)
    assert len(new['items']) == 16


def test_history_rejects_wrong_room():
    import pytest
    with pytest.raises(ValueError):
        module.merge_history(None, {'room_id': '999', 'observed_at': '2026-11-16T11:00:00Z'})
