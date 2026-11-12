import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from './en/common.json'
import auth from './en/auth.json'
import dashboard from './en/dashboard.json'
import minglers from './en/minglers.json'
import users from './en/users.json'
import finances from './en/finances.json'
import approvalQueue from './en/approval-queue.json'
import restaurants from './en/restaurants.json'
import rolesAccess from './en/roles-access.json'
import notifications from './en/notifications.json'
import profile from './en/profile.json'
import categories from './en/categories.json'
import loyalty from './en/loyalty.json'
import changeLog from './en/change-log.json'
import amenities from './en/amenities.json'
import preferenceQuestions from './en/preference-questions.json'
import interestTopics from './en/interest-topics.json'
import interestTables from './en/interest-tables.json'
import timerSettings from './en/timer-settings.json'
import interests from './en/interests.json'
import openApp from './en/open-app.json'
import emailTemplates from './en/email-templates.json'

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      common,
      auth,
      dashboard,
      minglers,
      users,
      finances,
      'approval-queue': approvalQueue,
      restaurants,
      'roles-access': rolesAccess,
      notifications,
      profile,
      categories,
      loyalty,
      'change-log': changeLog,
      amenities,
      'preference-questions': preferenceQuestions,
      'interest-topics': interestTopics,
      'interest-tables': interestTables,
      'timer-settings': timerSettings,
      interests,
      'open-app': openApp,
      'email-templates': emailTemplates,
    },
  },
  ns: [
    'common',
    'auth',
    'dashboard',
    'minglers',
    'users',
    'finances',
    'approval-queue',
    'restaurants',
    'roles-access',
    'notifications',
    'profile',
    'categories',
    'loyalty',
    'change-log',
    'amenities',
    'preference-questions',
    'interest-topics',
    'interest-tables',
    'timer-settings',
    'interests',
    'open-app',
    'email-templates',
  ],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})

export default i18n
