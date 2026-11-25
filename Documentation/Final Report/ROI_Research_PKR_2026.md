# Pricing GoMingle in rupees: Rs 0 tooling, people-heavy costs

The GoMingle build costs almost nothing to host and run as scoped, but a lot in people. Every tool in the stack (Vercel, Neon, Mailtrap Sending, GitHub, Jira, Figma Education, Gmail) has a free tier that covers a three-person team that never goes live, so the base-case monthly tooling cost is **Rs 0**. Even if every tool were moved to its cheapest paid plan, the bill would stay under about **Rs 50,000/month**. That makes team time the real cost driver. A blended mid-level Karachi developer costs about **PKR 150,000–180,000/month gross**, or roughly **PKR 850–1,000/hour** at 176 hours. That is roughly 4–9 times cheaper than the same person's freelance rate of **$15–30/hr (Rs 4,155–8,310)**. On revenue, the model has three core inputs: a mid-range Karachi dinner costs about **Rs 2,500 per cover** before tax, Pakistani restaurants are used to paying **about 25% commission on delivery**, and **Safepay charges 2.9% + Rs 30 plus 15% Sindh tax on the fee**. Nobody publishes a Pakistani dine-in booking commission or a local no-show rate, so those two inputs are derived from global benchmarks and should be stress-tested. All conversions use **Rs 277/USD**, rounded from the State Bank's 19 November 2026 selling rate of 276.66.

## One exchange rate anchors every USD line

The State Bank of Pakistan's weighted-average customer rate on **19 November 2026 was Rs 276.21 buying and Rs 276.66 selling** ([SBP](https://www.sbp.org.pk/assets/document/weighted-average-customer-exchange-rates-19-November-2026.pdf)). Interbank closes of about Rs 276.7 in the same month show the rupee holding steady ([ARY News](https://arynews.tv/us-dollar-closes-at-rs276-71-as-pkr-holds-steady-amid-middle-east-tensions)). Open-market quotes near Rs 277.5 put a ceiling on the spread ([ARY News](https://arynews.tv/pakistani-rupee-steady-near-277-5-against-us-dollar-as-hormuz-talks-swing-oil)). **Rs 277** is therefore a defensible base. A high case of Rs 290 (about 5% depreciation) is a modelling stress test, not a forecast. The rate matters most for the SaaS lines and for any freelance labour, both of which are priced in dollars.

## Free tiers cover the whole stack: tooling base case is Rs 0

Vercel Hobby is free and includes **100 GB of data transfer, 1 million function invocations and 4 active CPU-hours a month**, with 300-second function limits ([Vercel Hobby docs](https://vercel.com/docs/plans/hobby)). That is enough for two React portals and a NestJS API used by testers and examiners. It has two operational catches. First, Hobby offers **no team collaboration features**, and if you exceed a limit you wait out a 30-day window because you cannot buy more usage. Second, Vercel **cannot connect a Hobby project to a repo owned by a GitHub organization** ([Vercel Limits](https://vercel.com/docs/limits)), so the repo should sit under a personal account. Pro costs **$20 (Rs 5,540) per Developer seat per month**, and Viewer seats are free ([Vercel pricing](https://vercel.com/pricing)). Neon Free gives **100 CU-hours and 1 GB of storage per project** with scale-to-zero. Its cheapest paid plan, Launch, has no monthly minimum and bills **$0.106 per CU-hour and $0.35 per GB-month** ([Neon pricing](https://neon.com/pricing)). A modest always-warm workload of 60 CU-hours plus 1 GB would cost about $6.71 (Rs 1,859) a month. That figure is a calculation, not a quoted price.

Mailtrap is the one tool where the free tier is tight. Free Email Sending allows **4,000 emails a month (150 a day)**, but the free Email Sandbox allows only **50 test emails a month**. Sandbox Basic costs **$17/month (Rs 4,709)**, or $14 billed annually, and Sending Basic costs $15 (Rs 4,155) ([Mailtrap pricing](https://mailtrap.io/pricing/)). Three developers running automated E2E tests on OTP and verification flows will hit the 50-email ceiling quickly. That makes Sandbox Basic the most likely first paid line.

GitHub Actions minutes are **free and unmetered for public repositories**, and private repos get 2,000 minutes a month. Team costs $4 (Rs 1,108) per user ([GitHub pricing](https://github.com/pricing)), so APK builds in CI cost nothing. Jira Free covers **up to 10 users**, and Standard is about **$7.91 (Rs 2,191) per user/month**. That price comes from a January 2026 secondary source, because Atlassian's page did not render prices, and Atlassian usually raises prices each October ([eesel.ai](https://www.eesel.ai/blog/jira-pricing-guide)). Figma's **Education plan is free for verified students and includes all Professional features** ([Figma pricing FAQ](https://www.figma.com/pricing-faq/)). Professional seats cost Full $16, Dev $12 and Collab $3 a month ([Activepieces](https://www.activepieces.com/blog/figma-pricing-2026-plans-seats-and-billing-costs.md)). Google Workspace Business Starter is about **$8 (Rs 2,216) per user/month**, a figure cited by a Pakistani reseller because Google's Pakistan page did not render prices ([Leads Monky](https://leadsmonky.com/google-workspace-reseller-pakistan/)). It also requires a custom domain, so free Gmail is the sensible base case.

The scope exclusions remove the other costs. With APK-only distribution, neither the **Google Play $25 one-time fee nor Apple's $99 a year** applies ([FlutterFlow docs](https://docs.flutterflow.io/ffx/store-requirements.md)). There is no AWS line, and *.vercel.app makes a domain optional. If the team wants a .pk domain anyway, PKNIC charges about Rs 1,175 a year ([PKNIC](https://pknic.net.pk/docs-26/up719.html)).

| Tool | Base (free tier) | Cheapest paid, USD | Paid, PKR @277 |
|---|---|---|---|
| Vercel | Hobby, Rs 0 | Pro $20/Developer seat/mo | 5,540/seat; 16,620 for 3 |
| Neon Postgres | Free, Rs 0 | Launch, pay-as-you-go (~$6.71/mo illustrative) | ~1,859 |
| Mailtrap Sandbox | Free (50 emails/mo, marginal) | Basic $17/mo ($14 annual) | 4,709 (3,878) |
| Mailtrap Sending | Free (4,000/mo) | Basic $15/mo ($12 annual) | 4,155 (3,324) |
| GitHub | Free (public repo) | Team $4/user/mo | 1,108/user; 3,324 for 3 |
| Jira | Free (up to 10 users) | Standard ~$7.91/user/mo | 2,191/user; 6,573 for 3 |
| Figma | Education plan, Rs 0 | Full $16 + 2× Collab $3 = $22/mo | 6,094 |
| Google Workspace | Free Gmail, Rs 0 | Business Starter ~$8/user/mo | 2,216/user; 6,648 for 3 |
| Play / App Store / AWS | Excluded by scope | $25 once / $99/yr / n.a. | 0 in model |
| **Total** | **Rs 0/month** | **~$180/mo if everything goes paid** | **~Rs 49,982/month** |

## People, not platforms, dominate the build budget

No free source gives clean junior and mid-level salary splits for each role in Pakistan, and the P@SHA 2024–25 salary survey is paywalled ([P@SHA](https://www.pasha.org.pk/publications/salary-survey-2024-2025/)). The role bands below are therefore **synthesized from cited ranges, not quoted**. The anchors are current. Indeed Pakistan puts the average Software Engineer at **Rs 93,709/month (Karachi Rs 92,226)** ([Indeed](https://pk.indeed.com/career/software-engineer/salaries)), QA Engineer at **Rs 78,961 (Karachi Rs 82,030)** ([Indeed](https://pk.indeed.com/career/quality-assurance-engineer/salaries)), Project Manager at **Rs 95,122 (Karachi Rs 95,153)** ([Indeed](https://pk.indeed.com/career/project-manager/salaries)) and Junior Developer at **Rs 51,772** ([Indeed](https://pk.indeed.com/career/junior-developer/salaries)). Paylab's IT ranges cover about 80% of respondents. They run **Rs 55,784–204,047 for backend**, Rs 40,437–181,698 for frontend, Rs 47,185–222,724 for Android, Rs 82,573–315,689 for IT architects and Rs 63,389–236,404 for DevOps ([Paylab](https://www.paylab.com/pk/salaryinfo/information-technology?lang=en)). Paylab has no Flutter title, but PayScale lists Flutter developers at an early-career average of about **Rs 49k/month** ([PayScale](https://www.payscale.com/research/PK/Job=Flutter_Developer/Salary)). A 2026 training-provider survey places **mid-level (2–5 years) web developers at Rs 80k–150k**, with React and Node commanding a premium in Karachi ([PNY Trainings](https://www.pnytrainings.com/blog/webdevelopment/how-much-do-web-developers-earn-in-pakistan)).

To turn monthly pay into an hourly cost, divide by **176 hours** (22 days × 8 hours). That is the office convention, and it sits inside Pakistan's legal cap of 48 hours a week ([WageIndicator](https://wageindicator.org/en-pk/work-in-pakistan/labour-law/compensation-and-working-time/working-hours-and-overtime-pay-in-pakistan/)). A fully loaded employer cost is usually 20–30% above gross once bonuses, EOBI, leave and equipment are added. That uplift is industry convention and is not sourced here.

Freelance rates are a different basis entirely. A LUMS study of more than 16,000 Pakistani Upwork and Freelancer.com profiles found average rates of **$19/hr for men and $16/hr for women**, with software development earning about 46% more than design ([LUMS MHRC](https://mhrc.lums.edu.pk/skills-cities-and-gender-what-affects-freelance-earnings-pakistan)). Arc.dev puts senior Pakistani freelancers at **$20–45/hr** ([Arc.dev](https://arc.dev/employer-blog/how-much-do-freelance-developers-cost-around-the-world-2024/)). That makes a mid-level freelancer at $15–30/hr (Rs 4,155–8,310) about **4–9 times** the hourly cost of the same person on salary. The ROI sheet must name its labour basis: salaried cost, which fits a team that is employed or studying, or market rate, which fits pricing the build as if it were outsourced. The two bases produce answers an order of magnitude apart.

## Safepay costs 3.7% on a Rs 10,000 booking, and far more on small deposits

Safepay's own help centre lists two prices. The newer page, updated 28 January 2026, says **2.9% + Rs 30 domestic and 3.2% + Rs 30 international, exclusive of tax**, with no yearly fee and no minimum balance ([Safepay fee breakdown](https://safepay.helpscoutdocs.com/article/131-safepay-fee-breakdown)). An older FAQ, updated 6 February 2026 and pointing to the newer page, quotes a **flat 2.5% including taxes** ([Safepay FAQ](https://safepay.helpscoutdocs.com/article/120-how-much-does-safepay-charge)). A July 2026 market review lists fintech gateways (Safepay, XPay, PayPro) at **1.5–2.5% depending on package**, and bank gateways at 2–3.5% plus setup and annual fees ([XStak](https://xstak.com/blog/payment-gateways-in-pakistan)). Sales tax on the fee is **15% in Sindh** since 1 July 2024 ([VATupdate](https://www.vatupdate.com/2024/07/02/sindh-government-raises-sales-tax-to-15-and-introduces-8-rate-for-digital-payments)). Safepay's FAQ still shows the outdated 13%.

On the newer rate card, a Rs 10,000 table booking costs Rs 368, or **3.68%**. A single Rs 2,500 cover costs Rs 118, or **4.7%**. A Rs 1,000 deposit costs Rs 68, or **6.8%**, because the fixed Rs 30 dominates small tickets. Small deposits are therefore costly to process, and the model should charge the fee per booking rather than per seat where it can.

Safepay supports **authorize-then-capture** (`do_capture: false`, followed by a capture call), which suits seat holds ([Safepay docs](https://safepay-docs.netlify.app/modify-payments/capture)). Cards settle **at the end of the next working day** ([Safepay settlement](https://safepay.helpscoutdocs.com/article/94-how-settlement-works)). Several points are undocumented: whether voided or expired authorizations are billed, how long an authorization lasts, and whether wallets support separate capture. Each needs written confirmation from Safepay sales before the model treats pre-auth as free.

Two other rules apply. SBP sets **no e-commerce MDR cap**. Since 2023 it has capped only interchange, at 0.2% for debit and 0.7% for credit ([ProPakistani](https://propakistani.pk/2023/03/19/sbp-scraps-1-5-fee-on-debit-and-credit-card-transactions/)), so lower rates at volume are a matter of negotiation. Separately, since FY2025-26 payment intermediaries withhold **1% income tax on digitally paid receipts** ([Profit](https://profit.pakistantoday.com.pk/2025/08/05/fbr-issues-new-rules-for-e-commerce-seller-registration-tax-on-digital-transactions/)). The model should treat that as a cash-flow deduction, not a fee.

## Karachi diners spend about Rs 2,500 a head, but booking commission and no-show rates are unmeasured

Numbeo's February 2026 Karachi data prices a **three-course mid-range meal for two at Rs 3,750** (range Rs 2,200–8,000), or about Rs 1,875 per person on food alone ([Numbeo](https://www.numbeo.com/cost-of-living/in/Karachi)). Local press puts "fancy" dining at **Rs 3,500+ per person** and places like Pompei at about Rs 3,000 a head. Those figures date from 2023 ([Profit](https://profit.pakistantoday.com.pk/2023/01/16/sophistication-class-with-a-dash-of-european-tincture-and-you-have-the-fancy-restaurants-of-pakistan)). The model therefore uses **Rs 2,500 per cover** (mid-range with drinks) as the base and **Rs 5,500** for upscale venues. The upscale figure inflates the 2023 numbers by an assumed 25–40%. Sindh adds **15% sales tax, or 8% on card, wallet and QR payments**, except at 58 SRB-integrated Karachi operators allowed to charge 15% on cards ([Geo](https://www.geo.tv/latest/555650-karachis-58-restaurants-authorised-to-collect-nearly-double-service-tax)). Those 58 operators (Xander's, Chop Prime, Kababjees and others) are a ready list of premium launch partners.

Commission is the weakest input. Delivery platforms are a poor guide for a dine-in product. foodpanda averages **about 25%** ([Dawn, 2025](https://www.dawn.com/news/1941812)). In 2020 restaurants protested rates of 25–35%, and Careem won partners by cutting to **5%** ([Profit](https://profit.pakistantoday.com.pk/2020/12/12/food-delivery-wars-careem-slashes-commission-to-5pc-to-poach-restaurants)). No Pakistani table-booking app publishes its fees. That includes Bank Alfalah's Eatsy, which launched in June 2025 with 11 tier-one restaurants ([Qorus](https://www.qorusglobal.com/content/30347-bank-alfalah-launches-eatsy-pakistans-first-bank-led-restaurant-app)). Global booking platforms charge per seated cover instead. OpenTable charges **$1–1.50 (Rs 277–416)** on top of a monthly subscription ([Perfect Venue](https://www.perfectvenue.com/post/opentable-review)), and TheFork charges **€2–4** ([resOS](https://resos.com/alternatives-thefork/)). On a Rs 2,500 cover, OpenTable's fee works out to 11–17% of the bill. With no rider cost to justify a delivery-style take, a Karachi dine-in platform realistically sits at **5–10% of the bill, or Rs 150–300 per seated cover**. Careem's 5% is the floor that restaurants have already seen.

No-show data for Pakistan does not exist. The best recent measured benchmark is **3.7% no-shows plus 15% cancellations** across US full-service venues in 2025–26. Small parties of 1–2 no-show at 4.5%, compared with 1.8% for groups of 7+ ([Bloom Intelligence](https://bloomintelligence.com/blog/restaurant-no-shows/)). OpenTable reports that deposits cut no-shows by **60%** ([Restaurant Online](https://www.restaurantonline.co.uk/Article/2026/10/06/no-show-rates-fall-year-on-year-report-finds/)). GoMingle's model is strangers booking single seats at a shared table, which behaves like a set of 1–2-person parties, not one organised group. A base of **7% without a deposit** is therefore prudent. Applying the deposit effect (×0.4) gives about **3% with a deposit**.

## Recommended ROI model inputs

"Sourced" means the value is taken directly from a cited figure. "Derived" means it was calculated or synthesized from cited figures. "Assumption" means no source was found. Currency is PKR at Rs 277/USD unless stated.

| # | Input | Low | **Base** | High | Basis |
|---|---|---|---|---|---|
| 1 | USD/PKR rate | 276.2 | **277** | 290 | Base and low sourced (SBP, 19 Nov 2026); high is a derived stress case |
| 2 | Avg spend per cover, pre-tax | 1,900 | **2,500** | 5,500 | Low sourced (Numbeo); base and high derived (Numbeo + Profit 2023, inflated) |
| 3 | Sindh SST on restaurant bill | 8% | **8%** (digital) | 15% | Sourced (SRB via Geo) |
| 4 | Platform commission, % of bill | 5% | **7.5%** | 10% | Derived (Careem 5% floor; OpenTable-equivalent 11–17%; delivery 25% is not comparable) |
| 4a | Alternative: flat fee per seated cover | 150 | **200** | 300 | Derived (OpenTable $1–1.50 discounted for local market) |
| 5 | No-show rate, no deposit | 3.7% | **7%** | 10% | Low sourced (Bloom); base and high derived for single-seat social bookings |
| 5a | No-show rate, with deposit | 1.5% | **3%** | 4% | Derived (60% reduction, OpenTable) |
| 5b | Cancellation rate | 10% | **15%** | 20% | Base sourced (Bloom); range assumption |
| 6 | Safepay fee, domestic card | 2.5% all-in | **2.9% + Rs 30** | 3.2% + Rs 30 (intl) | Sourced (Safepay, both pages) |
| 6a | Sales tax on gateway fee (Sindh) | 15% | **15%** | 16% (Punjab/ICT) | Sourced |
| 6b | Effective gateway cost on Rs 2,500 cover | 2.5% | **4.7%** | 5.1% | Derived |
| 6c | Gateway setup / monthly fee | 0 | **0** | 0 | Sourced ("no yearly fees"); setup and payout fees unconfirmed |
| 7 | WHT on digital receipts (cash-flow) | 0% | **1%** | 1% | Sourced (FBR via Profit); whether it applies here needs tax advice |
| 8 | Blended mid-level salary, PKR/month | 150,000 | **165,000** | 180,000 | Derived from Indeed, Paylab, PNY |
| 8a | Blended hourly (÷176) | 852 | **938** | 1,023 | Derived |
| 8b | Employer loading on gross | 20% | **25%** | 30% | Assumption (industry convention) |
| 9 | Freelance mid rate, PKR/hr (outsourced basis) | 4,155 ($15) | **5,540 ($20)** | 8,310 ($30) | Derived from LUMS, Arc.dev, AAMAX |
| 10 | Role mid-level PKR/month: PM | 150,000 | **200,000** | 250,000 | Derived (Indeed, Paylab) |
| 10a | Architect / Tech Lead | 250,000 | **325,000** | 400,000 | Derived (Paylab) |
| 10b | Backend (NestJS) | 150,000 | **200,000** | 250,000 | Derived (Paylab, Indeed, PNY) |
| 10c | Frontend (React) | 130,000 | **175,000** | 220,000 | Derived (Paylab, PNY) |
| 10d | Flutter mobile | 140,000 | **185,000** | 230,000 | Derived (Paylab Android/iOS, PayScale) |
| 10e | UI/UX Designer | 110,000 | **145,000** | 180,000 | Derived (PayScale, Paylab) |
| 10f | QA Engineer | 110,000 | **145,000** | 180,000 | Derived (Indeed, Paylab) |
| 10g | Business Analyst | 120,000 | **155,000** | 190,000 | Derived (Indeed, Paylab) |
| 10h | DevOps | 170,000 | **215,000** | 260,000 | Derived (Paylab) |
| 11 | Monthly SaaS / hosting total | 0 | **0** | 49,982 | Base sourced (all free tiers); high derived (every tool on cheapest paid plan, 3 users) |
| 11a | Likely first paid lines (Mailtrap Sandbox + 1 Vercel Pro seat) | 0 | 0 | 10,249 | Derived ($37/mo) |
| 12 | Vercel Pro per Developer seat | — | **5,540** | — | Sourced ($20) |
| 13 | Neon Launch (illustrative usage) | 0 | **0** | 1,859 | Rates sourced; usage derived |
| 14 | Mailtrap Sandbox Basic | 0 | **0** | 4,709 | Sourced ($17) |
| 15 | Jira Standard (3 users) | 0 | **0** | 6,573 | Sourced, secondary ($7.91, Jan 2026) |
| 16 | Figma (Education vs 1 Full + 2 Collab) | 0 | **0** | 6,094 | Sourced |
| 17 | GitHub Team (3 users) | 0 | **0** | 3,324 | Sourced ($4) |
| 18 | Google Workspace Starter (3 users) | 0 | **0** | 6,648 | Sourced, reseller ($8) |
| 19 | App store, AWS, go-live costs | 0 | **0** | 0 | Excluded by scope (Play $25 / Apple $99 noted only) |
| 20 | Domain (.pk, optional) | 0 | **0** | 1,175/yr | Sourced (PKNIC) |

## Conclusion

The ROI model's sensitivity lies almost entirely on the revenue side and in the labour basis, not in infrastructure. Changing every SaaS line from free to paid moves annual cost by about Rs 0.6 million. Moving from salaried to freelance labour, or from 5% to 10% commission, moves the answer by multiples of that. The spreadsheet should therefore show tornado or scenario rows for commission, spend per cover, no-show rate and labour basis, and keep tooling as a single near-zero line.

Two design implications follow from the numbers. First, Safepay's fixed Rs 30 makes per-seat micro-deposits uneconomic below about Rs 1,000. Collecting one booking-level hold, or folding the deposit into the bill, keeps the gateway cost near 3–4% instead of 7–10%. Second, because no Pakistani dine-in commission benchmark exists, the most valuable next step is primary research: a few calls to the 58 SRB-integrated Karachi operators, or to Eatsy partners, asking what they would pay per seated cover. That would replace the model's least certain input with an actual local figure.
