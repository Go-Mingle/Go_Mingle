import { Alert, Spin } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { RestaurantDetailTabs } from './components/restaurantDetailTabs'
import { ProfileHeader } from './partnerProfile/components/ProfileHeader'
import { ProfileBanners } from './partnerProfile/components/ProfileBanners'
import {
  NameLocationModal,
  PaymentsReturnNotice,
  RestaurantImageModal,
  SetUpPaymentsModal,
  SubmittedModal,
} from './partnerProfile/components/ProfileModals'
import { OverviewTab } from './partnerProfile/components/OverviewTab'
import { OverviewModals } from './partnerProfile/components/OverviewModals'
import { ContactsTab } from './partnerProfile/components/ContactsTab'
import { useProfileFeedback } from './partnerProfile/hooks/useProfileFeedback'
import { useProfilePage } from './partnerProfile/hooks/useProfilePage'
import { useOverviewCards } from './partnerProfile/hooks/useOverviewCards'
import { useProfileContacts } from './partnerProfile/hooks/useProfileContacts'
import { DocumentsTab } from './partnerMedia/components/DocumentsTab'
import { PhotosVideosTab } from './partnerMedia/components/PhotosVideosTab'
import { useDocumentsTab } from './partnerMedia/hooks/useDocumentsTab'
import { usePhotosVideosTab } from './partnerMedia/hooks/usePhotosVideosTab'
import { AmenitiesTab } from './partnerAmenities/components/AmenitiesTab'
import { useAmenitiesTab } from './partnerAmenities/hooks/useAmenitiesTab'
import { MenuOptionsTab } from './partnerMenu/components/MenuOptionsTab'
import { useMenuTab } from './partnerMenu/hooks/useMenuTab'
import { TableTimingsTab } from './partnerTables/components/TableTimingsTab'
import { useTableTimingsTab } from './partnerTables/hooks/useTableTimingsTab'
import { InterestTablesTab } from './partnerInterestTables/components/InterestTablesTab'
import { useInterestTablesTab } from './partnerInterestTables/hooks/useInterestTablesTab'
import { ReviewsTab } from './partnerReviews/components/ReviewsTab'
import { useReviewsTab } from './partnerReviews/hooks/useReviewsTab'
import { PayoutAccountTab } from './partnerPayout/components/PayoutAccountTab'
import { PAYOUT_ACCOUNT_TAB_KEY } from './partnerPayout/constants'

/**
 * Restaurant Profile — the J6A shell (US-01) and the contract-backed tabs.
 *
 * The header, Overview and Contacts run on the versioned partner contract
 * (`/api/v1/partner/restaurant`), which resolves the restaurant from the token
 * and carries the derived state the page needs: `editable`,
 * `submissionReadiness`, `paymentConfigured` and the rejection history. J6B adds
 * Documents and Photos & Videos, J6C Amenities, J6D Menu Options, J6E Table
 * Timings, J6F Interest Tables and J6G Reviews on the same contract.
 *
 * All nine tabs are now contract-backed, so the prototype `GET /api/restaurants/{id}`
 * read this page used to make alongside them is gone — it was a route the backend
 * never built, existing only in MSW, and Reviews was its last consumer.
 */
export function RestaurantProfilePage() {
  const { t } = useTranslation(['restaurants', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()

  // One toast channel for the page — three separate message instances rendered
  // three holders with the same React key.
  const feedback = useProfileFeedback()
  const c = useProfilePage(feedback)
  const cards = useOverviewCards(c.profile, feedback)
  const contacts = useProfileContacts(c.editable, feedback)
  const documents = useDocumentsTab(c.editable, feedback)
  const gallery = usePhotosVideosTab(c.editable, feedback)
  const amenities = useAmenitiesTab(c.editable, feedback)
  const menu = useMenuTab(c.editable, feedback)
  const tables = useTableTimingsTab(c.editable, feedback)
  // Read-only: the grid needs no feedback channel and no editable flag, because the
  // partner cannot create, edit or cancel an interest table (BR-02).
  const interestTables = useInterestTablesTab()
  // Read-only too, but it does take the feedback channel: a review an admin deleted
  // 404s the detail read, and the recovery closes the modal — so the only place left to
  // say so is a toast (BR-10).
  const reviews = useReviewsTab(feedback)

  const activeTab = searchParams.get('tab') ?? 'overview'

  const setActiveTab = (key: string) => {
    const next = new URLSearchParams(searchParams)
    if (key === 'overview') next.delete('tab')
    else next.set('tab', key)
    setSearchParams(next, { replace: true })
  }

  if (c.isPending) {
    return (
      <div className="flex justify-center py-24">
        <Spin />
      </div>
    )
  }

  if (c.isError || !c.profile) {
    return (
      <Alert
        type="error"
        className="m-4"
        message={getApiErrorMessage(c.error, t('common:errors.fetchError'))}
      />
    )
  }

  const profile = c.profile

  return (
    <div>
      {feedback.contextHolder}

      <PaymentsReturnNotice c={c} />

      <ProfileHeader
        profile={profile}
        onEditName={c.openNameModal}
        onOpenImage={c.openImageModal}
        // The payout account lives on its own tab now, so the header opens it
        // there rather than handing off to an external setup page.
        onOpenPayments={() => setActiveTab(PAYOUT_ACCOUNT_TAB_KEY)}
        onToggleVisibility={c.toggleVisibility}
        onSubmit={c.handleSubmit}
        submitting={c.submitting}
        saving={c.saving}
        launchingPayments={c.launchingPayments}
      />

      <ProfileBanners
        status={profile.status}
        rejections={c.rejections}
        blockers={c.blockers}
        readiness={profile.submissionReadiness}
      />

      <RestaurantDetailTabs
        // Both are prototype-shaped props the nine injected tabs no longer read; they
        // stay on the component for the Profile Setup wizard and the prototype detail
        // page, which still call it without any of them.
        restaurant={{}}
        reviews={[]}
        /**
         * Reviews is Active-only; the other eight tabs show in every profile state.
         *
         * MET-1306 gates it back on status, reversing MET-1261 which had made it
         * unconditional. Note this puts the strip at odds with J6G BR-11, which calls
         * the tab "viewable whenever the portal is reachable (a PENDING/read-only
         * profile still shows reviews — there are no actions to gate)" and treats the
         * absence of reviews pre-approval as a data fact, not a visibility rule. The
         * gate here is a product decision taken against that wording; if BR-11 is
         * amended, this reverts to an unconditional `hasReviewsAccess`.
         *
         * Interest Tables stays ungated. It is read-only for the same reason (J6F
         * BR-02) and J6F BR-07 calls it viewable throughout, so MET-1249 stands —
         * DRAFT/PENDING/REJECTED see eight tabs, ACTIVE sees nine.
         */
        hasReviewsAccess={profile.status === 'ACTIVE'}
        hasInterestTablesAccess
        t={t}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        overviewTab={
          <OverviewTab
            profile={profile}
            cards={cards}
            cardsNeedingAttention={c.cardsNeedingAttention}
          />
        }
        contactsTab={<ContactsTab c={contacts} />}
        documentsTab={<DocumentsTab c={documents} />}
        photosVideosTab={<PhotosVideosTab c={gallery} />}
        amenitiesTab={<AmenitiesTab c={amenities} />}
        menuOptionsTab={<MenuOptionsTab c={menu} />}
        tableTimingsTab={<TableTimingsTab c={tables} />}
        interestTablesTab={<InterestTablesTab c={interestTables} />}
        reviewsTab={<ReviewsTab c={reviews} />}
        payoutAccountTab={<PayoutAccountTab feedback={feedback} />}
      />

      <NameLocationModal c={c} />
      <RestaurantImageModal c={c} />
      <SetUpPaymentsModal c={c} />
      <SubmittedModal c={c} />
      <OverviewModals cards={cards} />
    </div>
  )
}
