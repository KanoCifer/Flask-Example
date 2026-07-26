// import the core library.
import ReactEChartsCore from 'echarts-for-react';
// Import the echarts core module, which provides the necessary interfaces for using echarts.
import * as echarts from 'echarts/core';
// Import charts, all with Chart suffix
import { LineChart } from 'echarts/charts';
// import components, all suffixed with Component
import {
  // GridSimpleComponent,
  GridComponent,
  // AxisPointerComponent,
  // BrushComponent,
  TitleComponent,
  // PolarComponent,
  // RadarComponent,
  // GeoComponent,
  // SingleAxisComponent,
  // ParallelComponent,
  // CalendarComponent,
  // GraphicComponent,
  // ToolboxComponent,
  TooltipComponent,
} from 'echarts/components';
// Import renderer, note that introducing the CanvasRenderer or CanvasRenderer is a required step
import { CanvasRenderer } from 'echarts/renderers';

// Register the required components
echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LineChart,
  CanvasRenderer,
]);

interface TideChartProps {
  option: Record<string, unknown>;
}

export function TideChart({ option }: TideChartProps) {
  return (
    <ReactEChartsCore
      option={option}
      notMerge
      lazyUpdate
      // animation 默认在 option 里关掉 (避免 zrender 动画插值撞到 undefined 数组)
      style={{ height: '100%', width: '100%' }}
    />
  );
}
