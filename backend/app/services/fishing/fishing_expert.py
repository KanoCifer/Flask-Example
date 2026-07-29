"""
专家规则评分公式
基于天气、潮汐特征计算钓鱼指数
"""

from __future__ import annotations

import numpy as np

from app.core.logger import logger


class FishingExpertScorer:
    """
    专家规则钓鱼评分器

    公式: Expert_score = w1*f1 + w2*f2 + ... + w9*f9
    """

    # 权重配置
    WEIGHTS = {  # noqa: RUF012
        "w1": 4 / 23,  # 温度
        "w2": 2 / 23,  # 湿度
        "w3": 2 / 23,  # 气压
        "w4": 2 / 23,  # 风速
        "w5": 1 / 23,  # 降雨
        "w6": 4 / 23,  # 涨潮
        "w7": 4 / 23,  # 距低潮时间
        "w8": 2 / 23,  # 潮差
        "w9": 2 / 23,  # 和风天气钓鱼指数
    }

    @staticmethod
    def score_temperature(temp: float) -> float:
        """
        w1 温度评分: 20-28°C = 1分, 否则按偏离扣分
        """
        if 20 <= temp <= 28:
            return 1.0
        elif temp < 20:
            # 每降低1°C扣0.05分
            return max(0.0, 1.0 - (20 - temp) * 0.05)
        else:
            # 每升高1°C扣0.05分
            return max(0.0, 1.0 - (temp - 28) * 0.05)

    @staticmethod
    def score_humidity(humidity: float) -> float:
        """
        w2 湿度评分: 75% = 1分, 偏离扣分
        """
        if humidity == 75:
            return 1.0
        diff = abs(humidity - 75)
        return max(0.0, 1.0 - diff * 0.02)

    @staticmethod
    def score_pressure(pressure: float) -> float:
        """
        w3 气压评分: 高压高分
        f_pressure = (pressure - 1000) / 25
        """
        f_pressure: float = (pressure - 1000) / 25
        return min(max(f_pressure, 0.0), 2.0)  # 限制在0-2范围

    @staticmethod
    def score_wind(wind_speed: float) -> float:
        """
        w4 风速评分: 过大扣分，>3m/s(约10.8km/h)开始扣分
        注意: wind_speed 输入是 km/h
        """
        # 转换 km/h -> m/s
        wind_speed_ms = wind_speed / 3.6 if wind_speed >= 0 else 0
        logger.debug(
            f"[钓鱼指数] 风速评分: 输入={wind_speed} km/h, 转换={wind_speed_ms:.2f} m/s, 阈值=3 m/s"
        )
        if wind_speed_ms <= 3:
            result = 1.0
            logger.debug(f"[钓鱼指数] 风速评分: {result} (<=3 m/s)")
        else:
            # 每超过3m/s 1m/s扣0.33分
            result = max(0.0, 1.0 - (wind_speed_ms - 3) * 0.33)
            logger.debug(
                f"[钓鱼指数] 风速评分: {result:.3f} (>3 m/s, 扣分: {(wind_speed_ms - 3) * 0.33:.2f})"
            )
        return result

    @staticmethod
    def score_rain(precipitation: float) -> float:
        """
        w5 降雨评分: 降雨扣分
        无雨=1, 小雨扣0.5, 中雨+扣1
        """
        if precipitation == 0:
            return 1.0
        elif precipitation < 2.5:  # 小雨
            return 0.5
        else:  # 中雨及以上
            return 0.0

    @staticmethod
    def score_tide_rising(tide_type: str) -> float:
        """
        w6 是否涨潮: 涨潮=1, 退潮=0.5
        """
        return 1.0 if tide_type == "涨潮" else 0.5

    @staticmethod
    def score_hours_to_tide(hours: float) -> float:
        """
        w7 距低潮时间: 线性衰减
        0h=1分, 3h=0.5分, 6h=0分
        """
        if hours <= 0:
            return 1.0
        elif hours >= 6:
            return 0.0
        else:
            # 线性衰减: (6 - hours) / 6
            return (6 - hours) / 6

    @staticmethod
    def score_tide_range(tide_range: float) -> float:
        """
        w8 高低潮差: 越大越高分
        最佳潮差2-3m为满分1分
        """
        if tide_range >= 2:
            return 1.0
        elif tide_range < 1:
            return 0.3
        else:
            # 线性映射 1-2m之间
            return 0.3 + (tide_range - 1) * 0.5

    @staticmethod
    def score_indices(indices: int) -> float:
        """
        w9 和风钓鱼指数: 适宜(1)->1.0, 较适宜(2)->0.5, 不宜(3)->0.0
        """
        mapping = {1: 1.0, 2: 0.5, 3: 0.0}
        return mapping.get(indices, 0.5)

    def calculate(
        self,
        temperature: float,
        humidity: float,
        pressure: float,
        wind_speed: float,
        precipitation: float,
        tide_type: str,
        hours_to_tide: float,
        tide_range: float,
        indices: int,
    ) -> float:
        """
        计算专家评分

        Args:
            temperature: 温度 °C
            humidity: 湿度 %
            pressure: 气压 hPa
            wind_speed: 风速 m/s
            precipitation: 降水量 mm
            tide_type: "涨潮" | "退潮"
            hours_to_tide: 距低潮时间（小时）
            tide_range: 潮差 m
            indices: 和风指数 1-3

        Returns:
            专家评分 0-100
        """
        w1 = self.score_temperature(temperature)
        w2 = self.score_humidity(humidity)
        w3 = self.score_pressure(pressure)
        w4 = self.score_wind(wind_speed)
        w5 = self.score_rain(precipitation)
        w6 = self.score_tide_rising(tide_type)
        w7 = self.score_hours_to_tide(hours_to_tide)
        w8 = self.score_tide_range(tide_range)
        w9 = self.score_indices(indices)

        score = (
            self.WEIGHTS["w1"] * w1
            + self.WEIGHTS["w2"] * w2
            + self.WEIGHTS["w3"] * w3
            + self.WEIGHTS["w4"] * w4
            + self.WEIGHTS["w5"] * w5
            + self.WEIGHTS["w6"] * w6
            + self.WEIGHTS["w7"] * w7
            + self.WEIGHTS["w8"] * w8
            + self.WEIGHTS["w9"] * w9
        )

        logger.debug(
            f"[钓鱼指数] 各特征评分: temp={w1:.3f}, humidity={w2:.3f}, "
            f"pressure={w3:.3f}, wind={w4:.3f}, rain={w5:.3f}, "
            f"tide_rising={w6:.3f}, hours_to_tide={w7:.3f}, "
            f"tide_range={w8:.3f}, indices={w9:.3f}"
        )
        logger.debug(
            f"[钓鱼指数] 加权求和: score={score:.4f}, 最终={np.clip(score * 100, 0, 100):.1f}"
        )

        return np.clip(score * 100, 0, 100)

    def get_feature_scores(
        self,
        temperature: float,
        humidity: float,
        pressure: float,
        wind_speed: float,
        precipitation: float,
        tide_type: str,
        hours_to_tide: float,
        tide_range: float,
        indices: int,
    ) -> dict[str, float]:
        """
        获取各特征评分详情（用于调试和展示）
        """
        return {
            "w1_temp": self.score_temperature(temperature),
            "w2_humidity": self.score_humidity(humidity),
            "w3_pressure": self.score_pressure(pressure),
            "w4_wind": self.score_wind(wind_speed),
            "w5_rain": self.score_rain(precipitation),
            "w6_tide_rising": self.score_tide_rising(tide_type),
            "w7_hours_to_tide": self.score_hours_to_tide(hours_to_tide),
            "w8_tide_range": self.score_tide_range(tide_range),
            "w9_indices": self.score_indices(indices),
        }
