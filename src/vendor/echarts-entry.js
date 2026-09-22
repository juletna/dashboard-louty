import { getInstanceByDom, init, use } from 'echarts/core';
import { GaugeChart, BarChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, MarkLineComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

use([GaugeChart, BarChart, GridComponent, MarkLineComponent, TooltipComponent, SVGRenderer]);
export { getInstanceByDom, init };
