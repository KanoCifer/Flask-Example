from app.core.config import get_env_file_path, get_settings


def test_config_loading():
    # 测试配置是否正确加载
    print(get_settings().DATABASE_URL)
    print(get_settings().MONGO_URI)
    print(get_env_file_path())
    print(f"SEND_BOOT_EMAIL: {get_settings().SEND_BOOT_EMAIL}")
    print(f"ADMIN_EMAIL: {get_settings().ADMIN_EMAIL}")
    print(f"FEISHU_WEBHOOK_URL: {get_settings().FEISHU_WEBHOOK_URL}")
    print(f"VITE_JS_API_TOKEN: {get_settings().VITE_JS_API_TOKEN}")
    print(f"AMAP_SECURITY_CODE: {get_settings().AMAP_SECURITY_CODE}")
    print(f"AMAP_WEB_KEY: {get_settings().AMAP_WEB_KEY}")
    print(f"JWT_PRIVATE_KEY: {get_settings().JWT_PRIVATE_KEY}")
    print(f"RABBITMQ_URL: {get_settings().RABBITMQ_URL}")
