import asyncio

from rich import print

from app.core.agent import AiAgent
from app.schemas.aiagent import WeatherAnalysisInput


async def test_ai_agent():
    agent = AiAgent()
    data = WeatherAnalysisInput(weather_data={})

    result = agent.analyze_weather_stream(data)
    async for chunk in result:
        print(chunk)


if __name__ == "__main__":
    asyncio.run(test_ai_agent())
