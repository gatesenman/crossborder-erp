import ReactECharts from 'echarts-for-react';
export default function Chart({ option, height = 280 }: { option: any; height?: number }) {
  return <ReactECharts option={{ color: ['#1668dc', '#52c41a', '#fa8c16', '#722ed1', '#13c2c2', '#eb2f96', '#faad14', '#2f54eb'], textStyle: { fontFamily: 'inherit' }, ...option }} style={{ height }} notMerge />;
}
