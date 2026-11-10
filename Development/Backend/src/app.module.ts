import { Controller, Get, Module } from '@nestjs/common'
import { DatabaseModule } from './db/holder'
import { config } from './config'
import { TokensService } from './auth/tokens.service'
import { CodesService } from './auth/codes.service'
import { AccountDirectory } from './shared/accounts/account-directory.service'
import { ChangeLogService } from './shared/changelog/changelog.service'
import { AuditInterceptor } from './shared/changelog/audit.interceptor'
import { AdminAccountsService } from './admin/access/admin-accounts.service'
import { AdminGuard } from './admin/access/admin.guard'
import { AdminAuthController } from './admin/access/admin-auth.controller'
import { RolesController } from './admin/access/roles.controller'
import { UsersController } from './admin/access/users.controller'
import { ChangeLogController } from './admin/changelog.controller'
import { CategoriesController } from './admin/catalog/categories.controller'
import { InterestsController } from './admin/catalog/interests.controller'
import { AmenitiesController } from './admin/catalog/amenities.controller'
import { TopicsController } from './admin/catalog/topics.controller'
import { PreferenceQuestionsController } from './admin/catalog/preference-questions.controller'
import { LoyaltyController } from './admin/catalog/loyalty.controller'
import { BucketController, UploadsController } from './admin/uploads.controller'
import { AmenityIconsController } from './shared/amenity-icons.controller'
import { UsageService } from './shared/usage.service'
import { PartnerAccountsService } from './partner/access/partner-accounts.service'
import { PartnerGuard } from './partner/access/partner.guard'
import { PartnerAuthController } from './partner/access/partner-auth.controller'
import { SessionController } from './partner/access/session.controller'
import { SignupController } from './partner/access/signup.controller'
import { ProfileController } from './partner/profile/profile.controller'
import { ProfileService } from './partner/profile/profile.service'
import { RestaurantsService } from './shared/restaurants/restaurants.service'
import { ReviewService } from './shared/restaurants/review.service'
import { NotificationsService } from './shared/notifications/notifications.service'
import { MediaService } from './partner/media/media.service'
import { MediaController } from './partner/media/media.controller'
import { AssetsController } from './partner/media/assets.controller'
import { PayoutService } from './shared/payments/payout.service'
import { PayoutSetupController } from './shared/payments/payout-setup.controller'
import { PayoutAccountController } from './partner/payments/payout-account.controller'
import { AdminRestaurantsService } from './admin/restaurants/admin-restaurants.service'
import { ApprovalsController } from './admin/restaurants/approvals.controller'
import { RestaurantsController } from './admin/restaurants/restaurants.controller'
import { PartnerAmenitiesController } from './partner/amenities/amenities.controller'
import { CountersService } from './shared/counters.service'
import { TablesController } from './partner/venue/tables.controller'
import { MenuController, MenuUploadController } from './partner/venue/menu.controller'
import { AccountController } from './partner/team/account.controller'
import { TeamController } from './partner/team/team.controller'
import { AdminNotificationsController } from './admin/notifications.controller'
import { PartnerNotificationsController } from './partner/notifications.controller'
import { InterestTablesService } from './shared/interest-tables/interest-tables.service'
import { InterestTablesController } from './admin/interest-tables/interest-tables.controller'
import { PartnerInterestTablesController } from './partner/interest-tables/interest-tables.controller'
import { FinancesController, MinglersController, ReviewsController, TimerSettingsController } from './admin/minglers/mingler-data.controller'
import { PartnerFinancesController, PartnerReviewsController } from './partner/ledger.controller'
import { WebhookController } from './partner/webhook.controller'
import { SafepayService } from './shared/payments/safepay.service'
import { EscrowService } from './shared/payments/escrow.service'
import { EscrowController } from './admin/escrow.controller'
import { PartnerEscrowController } from './partner/escrow.controller'
import { DashboardController } from './admin/dashboard.controller'
import { PartnerLegacyController } from './partner/legacy.controller'
import { BookingsService } from './shared/bookings/bookings.service'
import { BookingsController } from './admin/bookings.controller'
import { NoShowPolicyController } from './partner/no-show-policy.controller'
import './seed/catalog.seed'

@Controller()
class RootController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'gomingle-api', time: new Date().toISOString() }
  }

  @Get()
  root() {
    return {
      service: 'GoMingle API',
      portals: { admin: `${config.publicUrl}/admin/api/...`, partner: `${config.publicUrl}/partner/api/...` },
    }
  }
}

@Module({
  imports: [DatabaseModule],
  controllers: [
    RootController,
    AdminAuthController,
    RolesController,
    UsersController,
    ChangeLogController,
    CategoriesController,
    InterestsController,
    AmenitiesController,
    TopicsController,
    PreferenceQuestionsController,
    LoyaltyController,
    UploadsController,
    BucketController,
    AmenityIconsController,
    PartnerAuthController,
    SessionController,
    SignupController,
    MediaController,
    PayoutAccountController,
    PayoutSetupController,
    PartnerAmenitiesController,
    NoShowPolicyController,
    TablesController,
    DashboardController,
    PartnerLegacyController,
    EscrowController,
    PartnerEscrowController,
    PartnerReviewsController,
    PartnerFinancesController,
    WebhookController,
    MinglersController,
    BookingsController,
    ReviewsController,
    FinancesController,
    TimerSettingsController,
    InterestTablesController,
    PartnerInterestTablesController,
    AdminNotificationsController,
    PartnerNotificationsController,
    AccountController,
    TeamController,
    MenuController,
    MenuUploadController,
    ProfileController,
    ApprovalsController,
    RestaurantsController,
    AssetsController,
  ],
  providers: [
    TokensService,
    CodesService,
    AccountDirectory,
    ChangeLogService,
    UsageService,
    AuditInterceptor,
    AdminAccountsService,
    AdminGuard,
    PartnerAccountsService,
    PartnerGuard,
    RestaurantsService,
    ReviewService,
    NotificationsService,
    ProfileService,
    MediaService,
    PayoutService,
    CountersService,
    SafepayService,
    EscrowService,
    BookingsService,
    InterestTablesService,
    AdminRestaurantsService,
  ],
})
export class AppModule {}
