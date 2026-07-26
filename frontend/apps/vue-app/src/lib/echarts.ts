import {
  BarChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
} from 'echarts/charts';
import {
  CalendarComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

use([
  CanvasRenderer,
  BarChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  CalendarComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  VisualMapComponent,
  MarkLineComponent,
  MarkPointComponent,
  MarkAreaComponent,
]);
