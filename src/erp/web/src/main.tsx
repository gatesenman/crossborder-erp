import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { AppProvider } from './ctx';
import App from './App';
import './index.css';
dayjs.locale('zh-cn');
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1668dc', borderRadius: 4, fontSize: 13, controlHeight: 30 }, components: { Table: { cellPaddingBlockSM: 6, headerBg: '#f5f7fa' }, Menu: { darkItemBg: '#001a33', darkSubMenuItemBg: '#00142a', itemHeight: 38 } } }}>
    <AntApp><BrowserRouter><AppProvider><App /></AppProvider></BrowserRouter></AntApp>
  </ConfigProvider>
);
