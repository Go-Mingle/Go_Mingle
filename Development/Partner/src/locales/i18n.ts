import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from './en/common.json'
import auth from './en/auth.json'
import minglers from './en/minglers.json'
import users from './en/users.json'
import finances from './en/finances.json'
import restaurants from './en/restaurants.json'
import notifications from './en/notifications.json'
import profile from './en/profile.json'
import interestTables from './en/interest-tables.json'
import setup from './en/setup.json'
import integrations from './en/integrations.json'

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      common,
      auth,
      minglers,
      users,
      finances,
      restaurants,
      notifications,
      profile,
      'interest-tables': interestTables,
      setup,
      integrations,
    },
  },
  ns: [
    'common',
    'auth',
    'minglers',
    'users',
    'finances',
    'restaurants',
    'notifications',
    'profile',
    'interest-tables',
    'setup',
    'integrations',
  ],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})

export default i18n
