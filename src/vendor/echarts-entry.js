import { init, use } from 'echarts/core';
import { GaugeChart, BarChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, MarkLineComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

use([GaugeChart, BarChart, GridComponent, MarkLineComponent, TooltipComponent, SVGRenderer]);
export { init };
