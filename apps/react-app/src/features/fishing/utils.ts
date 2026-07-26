export const weatherIcon = (weather: string): string => {
  if (!weather) return '🌤️';
  if (weather.includes('晴')) return '☀️';
  if (weather.includes('多云')) return '⛅';
  if (weather.includes('阴')) return '☁️';
  if (weather.includes('雷')) return '⛈️';
  if (weather.includes('雨')) return '🌧️';
  if (weather.includes('雪')) return '❄️';
  if (weather.includes('风')) return '💨';
  if (weather.includes('雾') || weather.includes('霾')) return '🌫️';
  return '🌤️';
};

export const formatDistance = (distance: number): string => {
  return distance < 1000
    ? `${Math.round(distance)} 米`
    : `${(distance / 1000).toFixed(1)} 公里`;
};

export const formatDuration = (time: number): string => {
  if (time < 3600) {
    return `${Math.round(time / 60)} 分钟`;
  }

  const hour = Math.floor(time / 3600);
  const minute = Math.round((time % 3600) / 60);
  return `${hour} 小时 ${minute} 分钟`;
};
