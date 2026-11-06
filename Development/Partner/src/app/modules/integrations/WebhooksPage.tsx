import { Alert, Grid, Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { useWebhooksPage } from './hooks/useWebhooksPage'
import { WebhookStatusHeader } from './components/WebhookStatusHeader'
import { WebhooksTabs } from './components/WebhooksTabs'
import { WebhookModals } from './components/WebhookModals'

export function WebhooksPage() {
  const { t } = useTranslation(['integrations', 'common'])
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const c = useWebhooksPage()

  if (c.isPending) {
    return (
      <div className="flex justify-center py-24">
        <Spin />
      </div>
    )
  }

  if (c.isError || !c.config) {
    return (
      <Alert
        type="error"
        className="m-4"
        message={getApiErrorMessage(c.error, t('common:errors.fetchError'))}
      />
    )
  }

  return (
    <div>
      {c.contextHolder}

      <WebhookStatusHeader
        enabled={c.enabled}
        canEnable={c.canEnable}
        onToggleRequest={c.requestToggle}
      />

      <WebhooksTabs
        endpointUrl={c.endpointUrl}
        onEndpointChange={c.onEndpointChange}
        endpointError={c.errors.endpoint}
        bearerToken={c.tokenFieldValue}
        tokenRevealed={c.tokenRevealed}
        revealing={c.revealing}
        onToggleToken={c.onToggleToken}
        onTokenChange={c.onTokenChange}
        tokenError={c.errors.token}
        secretMasked={c.signingSecretMasked}
        onRotate={c.openRotate}
        rotating={c.rotating}
        onSave={c.saveSettings}
        saving={c.saving}
        canTest={c.canTest}
        testSending={c.testSending}
        onTest={c.sendTest}
        awaitingTestDelivery={c.awaitingTestDelivery}
        testDeliveryUnconfirmed={c.testDeliveryUnconfirmed}
        deliveries={c.deliveries}
        totalDeliveries={c.totalDeliveries}
        page={c.page}
        onPageChange={c.setPage}
        statusFilter={c.statusFilter}
        onStatusFilterChange={c.changeStatusFilter}
        onRefresh={c.refreshDeliveries}
        refreshing={c.deliveriesFetching}
        isMobile={isMobile}
        tab={c.tab}
        onTabChange={c.setTab}
      />

      <WebhookModals
        revealedSecret={c.revealedSecret}
        onCloseSecret={c.clearSecret}
        rotateOpen={c.rotateOpen}
        onRotateCancel={c.closeRotate}
        onRotateConfirm={c.confirmRotate}
        toggleTarget={c.toggleTarget}
        onToggleCancel={c.cancelToggle}
        onToggleConfirm={c.confirmToggle}
      />
    </div>
  )
}
