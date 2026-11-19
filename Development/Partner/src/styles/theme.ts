import { theme as antdThemeApi, type ThemeConfig } from 'antd'

/**
 * Candlelit palette for Ant Design (GM-334). The same values live as CSS tokens
 * in styles/index.css; antd needs real colours here because it derives hover,
 * active and tint shades from them.
 */
const FONT = "'Manrope', system-ui, sans-serif"

export const antdTheme: ThemeConfig = {
  token: {
    fontFamily: FONT,
    colorPrimary: '#D63A25',
    colorError: '#B42318',
    colorWarning: '#8A4F00',
    colorSuccess: '#0B7A64',
    colorInfo: '#2453C4',
    colorTextBase: '#1A1530',
    colorBgLayout: '#F7F5FC',
    colorBorder: '#D9D4E8',
    colorBorderSecondary: '#E6E2F0',
    // AntD's global `a` rule beats Tailwind's layered utilities, so this token
    // is what colours raw links. Hover/active match so links stay calm.
    colorLink: '#C8361F',
    colorLinkHover: '#C8361F',
    colorLinkActive: '#C8361F',
    borderRadius: 8,
    borderRadiusLG: 14,
  },
  components: {
    Table: {
      headerBg: '#F7F5FC',
      headerColor: '#5C5677',
      borderColor: '#E6E2F0',
      rowHoverBg: 'rgba(26, 21, 48, 0.04)',
    },
    Button: {
      borderRadius: 10,
      defaultBorderColor: '#D9D4E8',
    },
    Input: {
      borderRadius: 10,
      activeBorderColor: '#D63A25',
      hoverBorderColor: '#B9B3D6',
    },
    Modal: {
      borderRadiusLG: 18,
    },
  },
}

/**
 * Dark theme: antd's dark algorithm on the Midnight surfaces, matching the dark
 * CSS tokens in styles/index.css. Solid fills (primary buttons, badges) carry
 * Midnight text, because white on the bright ember fails contrast.
 */
export const antdDarkTheme: ThemeConfig = {
  algorithm: antdThemeApi.darkAlgorithm,
  token: {
    ...antdTheme.token,
    colorPrimary: '#FF6F5A',
    colorError: '#FF7B6B',
    colorWarning: '#FFB547',
    colorSuccess: '#3FD6B4',
    colorInfo: '#8AB8FF',
    colorTextBase: '#F4F1FF',
    colorTextLightSolid: '#14102A',
    colorBgBase: '#14102A',
    colorBgLayout: '#14102A',
    colorBgContainer: '#1E1838',
    colorBgElevated: '#241D45',
    colorBorder: '#3A3263',
    colorBorderSecondary: '#2E2752',
    colorText: '#F4F1FF',
    colorTextSecondary: '#D6D1EE',
    colorTextTertiary: '#B9B3D6',
    colorTextQuaternary: '#8E87B3',
    colorTextPlaceholder: '#8E87B3',
    colorLink: '#FF8A78',
    colorLinkHover: '#FF8A78',
    colorLinkActive: '#FF8A78',
  },
  components: {
    ...antdTheme.components,
    Table: {
      headerBg: '#221C40',
      headerColor: '#B9B3D6',
      borderColor: '#2E2752',
      rowHoverBg: 'rgba(255, 255, 255, 0.04)',
    },
    Button: {
      borderRadius: 10,
      defaultBorderColor: '#3A3263',
      defaultBg: '#221C40',
    },
    Input: {
      borderRadius: 10,
      activeBorderColor: '#FF6F5A',
      hoverBorderColor: '#4E4580',
    },
  },
}
