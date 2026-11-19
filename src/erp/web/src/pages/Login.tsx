import { Form, Input, Button, Checkbox, message } from 'antd';
import { UserOutlined, LockOutlined, GlobalOutlined, ShopOutlined, RocketOutlined, AccountBookOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../api';
import { useApp } from '../ctx';
export default function Login() {
  const nav = useNavigate(); const { setUser } = useApp(); const [loading, setLoading] = useState(false);
  const onFinish = async (v: any) => {
    setLoading(true);
    try {
      const r = await api('/login', { method: 'POST', body: v });
      localStorage.setItem('erp_token', r.token); localStorage.setItem('erp_user', JSON.stringify(r.user)); sessionStorage.removeItem('erp_tabs');
      setUser(r.user); message.success('登录成功，欢迎回来 ' + r.user.name); nav('/dashboard');
    } catch { } finally { setLoading(false); }
  };
  const feats = [[<GlobalOutlined />, '多平台多站点', 'Amazon / Shopify / TikTok Shop / Temu / eBay / Walmart 统一管理'], [<ShopOutlined />, '订单 · 采购 · 仓储一体化', '审单规则、拆合单、智能补货、海外仓与 FBA 库存'], [<RocketOutlined />, 'FBA 头程全链路', '货件计划、装箱、头程跟踪与运费分摊'], [<AccountBookOutlined />, '精细化利润核算', '佣金、FBA费、广告、COGS、头程、汇率逐单核算']];
  return (
    <div className="login-bg">
      <div style={{ flex: 1, color: '#fff', padding: '80px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div className="logo-mark" style={{ width: 44, height: 44, fontSize: 22, background: '#fff', color: '#1456d0' }}>E</div><div style={{ fontSize: 28, fontWeight: 700 }}>VivaHome 跨境电商 ERP</div></div>
        <div style={{ fontSize: 15, opacity: .8, margin: '14px 0 48px' }}>一站式跨境卖家运营管理平台 · 让每一单都算得清利润</div>
        {feats.map((f, i) => <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 26 }}><div style={{ fontSize: 22, width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f[0]}</div><div><div style={{ fontSize: 16, fontWeight: 600 }}>{f[1]}</div><div style={{ opacity: .7, fontSize: 13, marginTop: 2 }}>{f[2]}</div></div></div>)}
        <div style={{ opacity: .5, fontSize: 12, marginTop: 40 }}>© 2026 VivaHome Technology · v1.0.0</div>
      </div>
      <div style={{ width: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <div style={{ width: 360 }}>
          <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>账号登录</div>
          <div style={{ color: '#888', marginBottom: 30 }}>请使用企业账号登录系统</div>
          <Form size="large" onFinish={onFinish} initialValues={{ username: 'admin', password: 'admin123', remember: true }}>
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}><Input prefix={<UserOutlined />} placeholder="用户名" /></Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}><Input.Password prefix={<LockOutlined />} placeholder="密码" /></Form.Item>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><Form.Item name="remember" valuePropName="checked" noStyle><Checkbox>记住登录</Checkbox></Form.Item><a>忘记密码？</a></div>
            <Button type="primary" htmlType="submit" block loading={loading}>登 录</Button>
          </Form>
          <div style={{ marginTop: 24, padding: 12, background: '#f6f8fb', borderRadius: 4, fontSize: 12, color: '#666' }}>演示账号：admin / admin123（超级管理员）<br />其他账号：zhangxiao（运营）、zhoucg（采购）、liucang（仓管）、chencw（财务），密码均为 123456</div>
        </div>
      </div>
    </div>
  );
}
