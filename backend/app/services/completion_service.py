from agno.agent import Agent
from agno.models.base import Model


class CompletionService:
    def __init__(self, agent: Agent, model: Model):
        self.agent = agent
        self.model = model

    async def complete(self, prompt: str) -> str:
        pass
