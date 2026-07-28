"""飞书消息发送测试模块

用于调试和验证飞书 webhook 消息发送功能。
"""

import asyncio
from datetime import datetime

import httpx2
import pytest

from app.core import get_settings
from app.schemas.schemas import FeishuMessageContent, FeishuRichTextContent


@pytest.fixture
def feishu_webhook_url():
    """获取飞书 webhook URL"""
    settings = get_settings()
    url = settings.FEISHU_WEBHOOK_URL
    if not url:
        pytest.skip("FEISHU_WEBHOOK_URL 未配置")
    return url


def test_feishu_webhook_config():
    """测试飞书 webhook 配置是否正确"""
    settings = get_settings()
    url = settings.FEISHU_WEBHOOK_URL

    print(f"\n{'=' * 50}")
    print("飞书 Webhook 配置检查")
    print(f"{'=' * 50}")
    print(f"URL: {url or '未配置'}")

    if url:
        # 验证 URL 格式
        if url.startswith("https://open.feishu.cn/open-apis/bot/v2/hook/"):
            print("URL 格式正确")
        else:
            print("URL 格式可能不正确，预期格式:")
            print(
                "   https://open.feishu.cn/open-apis/bot/v2/hook/{webhook_id}"
            )
    else:
        print("请在 .env 文件中配置 FEISHU_WEBHOOK_URL")
        print(
            "   示例: FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
        )

    assert url, "FEISHU_WEBHOOK_URL 未配置"


async def send_feishu_text_message(url: str, text: str) -> dict:
    """直接发送纯文本消息到飞书 webhook

    :param url: 飞书 webhook URL
    :param text: 消息文本
    :return: 响应结果
    """
    payload = FeishuMessageContent(
        msg_type="text",
        content={"text": text},
    )

    async with httpx2.AsyncClient(timeout=httpx2.Timeout(10.0)) as client:
        response = await client.post(url, json=payload.model_dump())
        return {
            "status_code": response.status_code,
            "response": response.json() if response.content else None,
        }


async def send_feishu_post_message(url: str, title: str, message: str) -> dict:
    """直接发送富文本消息到飞书 webhook

    :param url: 飞书 webhook URL
    :param title: 消息标题
    :param message: 消息内容
    :return: 响应结果
    """
    # 飞书富文本消息格式需要包含 post 字段
    content = {
        "post": {
            "zh_cn": {
                "title": title,
                "content": [
                    [
                        {"tag": "text", "text": message},
                    ],
                    [
                        {
                            "tag": "a",
                            "text": "访问网站",
                            "href": "https://kanocifer.chat",
                        },
                    ],
                ],
            }
        }
    }
    payload = FeishuRichTextContent(msg_type="post", content=content)

    async with httpx2.AsyncClient(timeout=httpx2.Timeout(10.0)) as client:
        response = await client.post(url, json=payload.model_dump())
        return {
            "status_code": response.status_code,
            "response": response.json() if response.content else None,
        }


@pytest.mark.asyncio
async def test_send_text_message(feishu_webhook_url):
    """测试发送纯文本消息"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    text = f"测试消息 - 纯文本\n发送时间: {now}"

    result = await send_feishu_text_message(feishu_webhook_url, text)

    print(f"\n{'=' * 50}")
    print("纯文本消息发送结果")
    print(f"{'=' * 50}")
    print(f"状态码: {result['status_code']}")
    print(f"响应: {result['response']}")

    assert result["status_code"] == 200, f"发送失败: {result['response']}"

    # 飞书 API 返回 0 表示成功
    if result["response"]:
        assert result["response"].get("code") == 0, (
            f"飞书返回错误: {result['response']}"
        )


@pytest.mark.asyncio
async def test_send_post_message(feishu_webhook_url):
    """测试发送富文本消息"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    title = "测试消息 - 富文本"
    message = f"这是一条测试消息\n发送时间: {now}\n用于验证飞书 webhook 功能是否正常。"

    result = await send_feishu_post_message(feishu_webhook_url, title, message)

    print(f"\n{'=' * 50}")
    print("富文本消息发送结果")
    print(f"{'=' * 50}")
    print(f"状态码: {result['status_code']}")
    print(f"响应: {result['response']}")

    assert result["status_code"] == 200, f"发送失败: {result['response']}"

    if result["response"]:
        assert result["response"].get("code") == 0, (
            f"飞书返回错误: {result['response']}"
        )


def test_message_payload_format():
    """测试消息 payload 格式是否正确"""
    # 测试纯文本消息格式
    text_payload = FeishuMessageContent(
        msg_type="text",
        content={"text": "测试消息"},
    )
    text_dict = text_payload.model_dump()

    print(f"\n{'=' * 50}")
    print("消息 Payload 格式验证")
    print(f"{'=' * 50}")
    print(f"纯文本消息: {text_dict}")

    assert text_dict["msg_type"] == "text"
    assert text_dict["content"]["text"] == "测试消息"

    # 测试富文本消息格式
    post_content = {
        "zh_cn": {
            "title": "测试标题",
            "content": [
                [{"tag": "text", "text": "测试内容"}],
            ],
        }
    }
    post_payload = FeishuRichTextContent(msg_type="post", content=post_content)
    post_dict = post_payload.model_dump()

    print(f"富文本消息: {post_dict}")

    assert post_dict["msg_type"] == "post"
    assert post_dict["content"]["zh_cn"]["title"] == "测试标题"


def generate_daily_summary_message(
    date_str: str,
    total_visits: int,
    unique_visitors: int,
    unique_ips: int,
    top_pages: list | None = None,
    browser_stats: list | None = None,
    os_stats: list | None = None,
    device_stats: list | None = None,
) -> str:
    """生成每日统计摘要消息（模拟 send_daily_summary 的消息格式）

    :param date_str: 日期字符串，格式 YYYY-MM-DD
    :param total_visits: 总访问量
    :param unique_visitors: 独立访客数
    :param unique_ips: 独立IP数
    :param top_pages: 热门页面列表 [(page_path, count), ...]
    :param browser_stats: 浏览器统计 [(browser_name, count), ...]
    :param os_stats: 操作系统统计 [(os_name, count), ...]
    :param device_stats: 设备类型统计 [(device_type, count), ...]
    :return: 格式化的消息文本
    """
    lines = []
    lines.append("核心指标")
    lines.append(f"• 总访问量: {total_visits} 次")
    lines.append(f"• 独立访客: {unique_visitors} 人")
    lines.append(f"• 独立IP: {unique_ips} 个\n")

    if top_pages:
        lines.append("热门页面 Top 5")
        for page, count in top_pages:
            percentage = count / total_visits * 100 if total_visits > 0 else 0
            lines.append(f"• {page}: {count} 次 ({percentage:.1f}%)")
        lines.append("")

    if browser_stats:
        lines.append("浏览器分布")
        for browser, count in browser_stats:
            percentage = (
                count / unique_visitors * 100 if unique_visitors > 0 else 0
            )
            lines.append(
                f"• {browser or '未知'}: {count} 人 ({percentage:.1f}%)"
            )
        lines.append("")

    if os_stats:
        lines.append("操作系统分布")
        for os_name, count in os_stats:
            percentage = (
                count / unique_visitors * 100 if unique_visitors > 0 else 0
            )
            lines.append(
                f"• {os_name or '未知'}: {count} 人 ({percentage:.1f}%)"
            )
        lines.append("")

    if device_stats:
        lines.append("设备类型分布")
        for device, count in device_stats:
            percentage = (
                count / unique_visitors * 100 if unique_visitors > 0 else 0
            )
            lines.append(
                f"• {device or '未知'}: {count} 人 ({percentage:.1f}%)"
            )
        lines.append("")

    lines.append("────────────────")
    lines.append("此消息由 BOT 自动发送")
    return "\n".join(lines)


def test_daily_summary_message_format():
    """测试每日统计摘要消息格式"""
    # 模拟数据
    mock_top_pages = [
        ("/", 150),
        ("/blog", 80),
        ("/books", 45),
        ("/about", 20),
        ("/rss", 10),
    ]
    mock_browser_stats = [
        ("Chrome", 180),
        ("Safari", 60),
        ("Firefox", 30),
        (None, 5),
    ]
    mock_os_stats = [
        ("Windows", 120),
        ("macOS", 90),
        ("Linux", 40),
        (None, 10),
    ]
    mock_device_stats = [
        ("desktop", 200),
        ("mobile", 50),
        ("tablet", 10),
    ]

    message = generate_daily_summary_message(
        date_str="2026-03-23",
        total_visits=305,
        unique_visitors=275,
        unique_ips=200,
        top_pages=mock_top_pages,
        browser_stats=mock_browser_stats,
        os_stats=mock_os_stats,
        device_stats=mock_device_stats,
    )

    print(f"\n{'=' * 50}")
    print("每日统计摘要消息预览")
    print(f"{'=' * 50}")
    print(message)

    # 验证消息内容
    assert "核心指标" in message
    assert "• 总访问量: 305 次" in message
    assert "• 独立访客: 275 人" in message
    assert "• 独立IP: 200 个" in message
    assert "热门页面 Top 5" in message
    assert "/: 150 次 (49.2%)" in message
    assert "浏览器分布" in message
    assert "Chrome: 180 人 (65.5%)" in message
    assert "操作系统分布" in message
    assert "Windows: 120 人 (43.6%)" in message
    assert "设备类型分布" in message
    assert "desktop: 200 人 (72.7%)" in message


@pytest.mark.asyncio
async def test_send_daily_summary_message(feishu_webhook_url):
    """测试发送每日统计摘要消息到飞书"""
    # 模拟数据
    mock_top_pages = [
        ("/", 150),
        ("/blog", 80),
        ("/books", 45),
    ]
    mock_browser_stats = [
        ("Chrome", 180),
        ("Safari", 60),
    ]
    mock_os_stats = [
        ("Windows", 120),
        ("macOS", 90),
    ]

    message = generate_daily_summary_message(
        date_str="2026-03-23",
        total_visits=305,
        unique_visitors=275,
        unique_ips=200,
        top_pages=mock_top_pages,
        browser_stats=mock_browser_stats,
        os_stats=mock_os_stats,
    )

    result = await send_feishu_post_message(
        feishu_webhook_url,
        "每日访问统计 - 2026-03-23",
        message,
    )

    print(f"\n{'=' * 50}")
    print("每日统计摘要发送结果")
    print(f"{'=' * 50}")
    print(f"状态码: {result['status_code']}")
    print(f"响应: {result['response']}")

    assert result["status_code"] == 200, f"发送失败: {result['response']}"

    if result["response"]:
        assert result["response"].get("code") == 0, (
            f"飞书返回错误: {result['response']}"
        )


if __name__ == "__main__":
    """直接运行测试（不需要 pytest）"""

    async def main():
        print("飞书消息发送测试")
        print("=" * 50)

        # 1. 检查配置
        settings = get_settings()
        url = settings.FEISHU_WEBHOOK_URL

        if not url:
            print("FEISHU_WEBHOOK_URL 未配置")
            print("请在 .env 文件中添加:")
            print(
                "FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your_webhook_id"
            )
            return

        print(f"Webhook URL: {url[:50]}...")

        # 2. 发送测试消息
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        print("\n--- 测试纯文本消息 ---")
        try:
            result = await send_feishu_text_message(
                url, f"测试消息 - 纯文本\n发送时间: {now}"
            )
            print(f"状态码: {result['status_code']}")
            print(f"响应: {result['response']}")
        except Exception as e:
            print(f"发送失败: {e}")

        print("\n--- 测试富文本消息 ---")
        try:
            result = await send_feishu_post_message(
                url,
                "测试消息 - 富文本",
                f"这是一条测试消息\n发送时间: {now}",
            )
            print(f"状态码: {result['status_code']}")
            print(f"响应: {result['response']}")
        except Exception as e:
            print(f"发送失败: {e}")

        # 3. 测试每日统计摘要消息
        print("\n--- 测试每日统计摘要消息 ---")
        try:
            mock_top_pages = [
                ("/", 150),
                ("/blog", 80),
                ("/books", 45),
            ]
            mock_browser_stats = [
                ("Chrome", 180),
                ("Safari", 60),
            ]
            mock_os_stats = [
                ("Windows", 120),
                ("macOS", 90),
            ]

            message = generate_daily_summary_message(
                date_str="2026-03-23",
                total_visits=305,
                unique_visitors=275,
                unique_ips=200,
                top_pages=mock_top_pages,
                browser_stats=mock_browser_stats,
                os_stats=mock_os_stats,
            )
            print("消息预览:")
            print(message)

            result = await send_feishu_post_message(
                url,
                "每日访问统计 - 2026-03-23",
                message,
            )
            print(f"\n状态码: {result['status_code']}")
            print(f"响应: {result['response']}")
        except Exception as e:
            print(f"发送失败: {e}")

    asyncio.run(main())
