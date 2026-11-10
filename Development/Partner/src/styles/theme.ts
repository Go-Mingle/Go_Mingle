import { theme as antdThemeApi, type ThemeConfig } from 'antd'

export const antdTheme: ThemeConfig = {
  token: {
    fontFamily: "'Poppins', sans-serif",
    colorPrimary: '#0FA79D',
    colorError: '#C0392B',
    colorWarning: '#B06000',
    colorSuccess: '#1A8A5A',
    // Links render teal (accent), matching the source portal. AntD's default
    // colorLink is blue #1677ff, and its unlayered global `a` rule beats
    // Tailwind's layered color utilities — so this token, not a class, is what
    // makes raw <a> links teal. Hover/active kept equal to the base color so
    // links stay static like the source's inline-styled anchors.
    colorLink: '#0FA79D',
    colorLinkHover: '#0FA79D',
    colorLinkActive: '#0FA79D',
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

/**
 * Dark theme: antd's dark algorithm, tuned to the same surfaces as the dark
 * CSS tokens in styles/index.css so antd components and Tailwind utilities
 * sit on one palette.
 */
export const antdDarkTheme: ThemeConfig = {
  algorithm: antdThemeApi.darkAlgorithm,
  token: {
    ...antdTheme.token,
    colorPrimary: '#0FA79D',
    colorError: '#E05A4C',
    colorWarning: '#C27A1A',
    colorSuccess: '#2F9E6A',
    colorInfo: '#3D87E6',
    colorBgLayout: '#0E141C',
    colorBgContainer: '#18202B',
    colorBgElevated: '#1D2633',
    colorBorder: '#364356',
    colorBorderSecondary: '#273241',
    colorText: '#E7EBF1',
    colorTextSecondary: '#BCC5D2',
    colorTextTertiary: '#9AA5B5',
    colorTextQuaternary: '#6C788A',
    colorTextPlaceholder: '#6C788A',
    colorLink: '#19B5AA',
    colorLinkHover: '#19B5AA',
    colorLinkActive: '#19B5AA',
  },
  components: {
    ...antdTheme.components,
    Table: {
      headerBg: '#1D2633',
      headerColor: '#9AA5B5',
      borderColor: '#273241',
      rowHoverBg: 'rgba(255, 255, 255, 0.04)',
    },
    Button: {
      borderRadius: 6,
      defaultBorderColor: '#364356',
      defaultBg: '#1D2633',
    },
    Input: {
      borderRadius: 6,
      activeBorderColor: '#0FA79D',
      hoverBorderColor: '#4A5A70',
    },
  },
}
