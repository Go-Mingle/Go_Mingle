import type { ThemeConfig } from 'antd'

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
