import type { ThemeConfig } from 'antd'

export const antdTheme: ThemeConfig = {
  token: {
    fontFamily: "'Poppins', sans-serif",
    colorPrimary: '#0FA79D',
    colorError: '#C0392B',
    colorWarning: '#B06000',
    colorSuccess: '#1A8A5A',
    borderRadius: 6,
    borderRadiusLG: 12,
  },
  components: {
    Table: {
      headerBg: '#F8FAFB',
      headerColor: '#718096',
      borderColor: '#E8ECF0',
      rowHoverBg: 'rgba(26, 35, 50, 0.04)',
    },
    Button: {
      borderRadius: 6,
      defaultBorderColor: '#D1D9E0',
    },
    Input: {
      borderRadius: 6,
      activeBorderColor: '#0FA79D',
      hoverBorderColor: '#A0AEC0',
    },
    Modal: {
      borderRadiusLG: 16,
    },
  },
}
