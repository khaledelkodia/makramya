# مكرمية — متجر Next.js + Supabase

مشروع متجر عربي RTL لمكرميات وستائر يدوية، مبني بـ **Next.js App Router وTypeScript وSupabase**. فيه واجهة المتجر، طلبات العملاء، لوحة إدارة محمية، رفع صور المنتجات والصور المرجعية للعملاء، وتحديث حالات الطلبات.

## المتطلبات

- Node.js 20.9 أو أحدث وnpm.
- مشروع Supabase.

## 1. تثبيت وتشغيل Next.js

```bash
npm ci
Copy-Item .env.example .env.local
```

افتحي `.env.local` وضعي رابط مشروع Supabase والـ publishable key (تجديه في **Project Settings → API Keys**). استخدمي المفتاح العام `sb_publishable_...` أو مفتاح `anon` القديم. لا تضعي `service_role` أو `secret` في متغير يبدأ بـ `NEXT_PUBLIC_`.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=sb_secret_your_key
```

`SUPABASE_SERVICE_ROLE_KEY` مطلوب لإدارة حسابات فريق المتجر فقط. خذيه من **Project Settings → API Keys** كـ Secret key (`sb_secret_...`) أو مفتاح `service_role` القديم. هذا مفتاح خادم سري: لا تضعي قبله `NEXT_PUBLIC_` ولا ترفعي قيمته إلى GitHub. على Vercel أضيفيه من **Project Settings → Environment Variables**.

قبل النشر، غيّري `NEXT_PUBLIC_SITE_URL` إلى رابط الدومين النهائي بصيغة `https://...`؛ يُستخدم للروابط الأساسية وملفي sitemap وrobots وبيانات المشاركة المنظمة. بعد تغيير أي متغير على Vercel، أعيدي النشر.

## 2. تهيئة قاعدة Supabase

من مجلد المشروع، اربطي Supabase CLI بمشروعك ثم طبّقي migration قاعدة البيانات:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

أو افتحي `supabase/migrations/202611040001_initial_schema.sql` وانسخي محتواه إلى **SQL Editor** في لوحة Supabase وشغّليه مرة واحدة. الـ migration ينشئ المنتجات والطلبات وبنودها، صلاحيات RLS، دالة إنشاء طلب تحسب السعر من قاعدة البيانات، وbucket عام لصور المنتجات بسياسة رفع للإدارة فقط. كما يضيف منتجات تجريبية قابلة للتعديل والحذف.

بما إن قاعدة البيانات الأولية مطبّقة بالفعل، شغّلي أيضاً `supabase/migrations/202611040002_staff_roles.sql` مرة واحدة في **SQL Editor**. يضيف أدوار `owner` و`manager` و`products` و`orders` وسياسات RLS التي تقصر كل صلاحية على مهامها. الحساب الموجود يتحول تلقائياً إلى `owner`.

بعدها شغّلي `supabase/migrations/202611050001_order_tracking.sql` مرة واحدة. يسجل كل تحديث لحالة الطلب ويضيف RPC آمنة لصفحة `/track/[id]`؛ رابط العميل يعرض رقم الطلب والحالة وسجل تحديثاتها فقط.

ثم شغّلي `supabase/migrations/202611050006_order_tracking_id_prefix.sql` مرة واحدة. يسمح باسترجاع الطلب إذا نقص آخر حرف من معرّف رابط المتابعة، بشرط أن يطابق طلبًا واحدًا فقط.

لتفعيل رفع صور الأصناف من الداشبورد، شغّلي `supabase/migrations/202611050002_category_images.sql` مرة واحدة. بعدها افتحي **/dashboard/categories** لرفع أو استبدال صور مكرميات الحائط والستائر والديكور المنزلي؛ الصور تظهر في بطاقات الأصناف وصفحاتها.

لتعديل اسم ووصف الأصناف، شغّلي `supabase/migrations/202611050003_category_editing.sql` مرة واحدة. لإعداد التوصيل حسب المحافظة، شغّلي `supabase/migrations/202611050004_delivery_settings.sql` ثم `supabase/migrations/202611050005_delivery_governorates.sql` مرة واحدة لكل منهما، بعد ترحيل أدوار الفريق. بعدها افتحي **/dashboard/delivery**؛ تقدري تجمعي محافظات لها نفس السعر أو تضعي كل محافظة في مجموعة منفصلة. العميلة تختار المحافظة، وسعرها يُحسب داخل قاعدة البيانات ويُحفظ مع الطلب الجديد.

لتفعيل حسابات العملاء وسجل طلباتهم، شغّلي `supabase/migrations/202611050007_customer_accounts.sql` بعد ترحيل التوصيل والتتبع. أضيفي `https://makramya.vercel.app/auth/callback` إلى قائمة Redirect URLs في **Supabase → Authentication → URL Configuration** (وأضيفي `http://localhost:3000/auth/callback` للتطوير). مهم: ضبط `NEXT_PUBLIC_SITE_URL` وحده لا يكفي؛ يجب أن يكون callback ضمن Redirect URLs المسموحة، وإلا قد يرجع رابط التأكيد للصفحة الرئيسية. العميل يكتب بريده أثناء الطلب، وبعدها يقدر ينشئ كلمة مرور اختيارياً؛ بعد تأكيد البريد، تظهر في الحساب الطلبات المرتبطة بنفس البريد. بيانات آخر طلب تُحفظ في حسابها وتُملأ تلقائياً في الطلب التالي، مع إمكانية تعديل العنوان أو رقم التواصل. لتوصيل رسائل التفعيل للعملاء في الإنتاج، اضبطي مزود SMTP مخصصًا في إعدادات Supabase Auth. الطلبات القديمة التي لا تحتوي بريدًا تظل متاحة من رابط التتبع فقط.

لتفعيل متابعة السلات غير المكتملة والعروض والكوبونات، شغّلي `supabase/migrations/202611050008_cart_recovery_promotions.sql` مرة واحدة بعد ترحيل حسابات العملاء. بعدها شغّلي `supabase/migrations/202611050009_customer_reference_images.sql` لتفعيل رفع صورة مرجعية يرفقها العميل مع الطلب. من **/dashboard/delivery** فعّلي خيار **السماح برفع صورة مرجعية للطلب**؛ عند إيقافه يختفي الحقل من المتجر. الصور خاصة، بحد أقصى 5 ميجابايت وبصيغة JPG أو PNG أو WebP، وتظهر لفريق الطلبات داخل تفاصيل الطلب في **/dashboard/orders**.

## 3. إنشاء حساب صاحبة المتجر

من Supabase **Authentication → Users → Add user**، أنشئي مستخدماً بالبريد وكلمة مرور تختاريهما. بعدها شغّلي هذا الاستعلام من **SQL Editor** بعد استبدال البريد:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'owner@example.com'
on conflict (user_id) do nothing;
```

تسجيل الدخول متاح في `/login`، والداشبورد في `/dashboard`. صاحبة الحساب `owner` تقدر تضيف مستخدمين وتغيّر أدوارهم أو تحذفهم من `/dashboard/users`. إدارة المنتجات وإضافة الصور متاحة لأدوار `owner` و`manager` و`products`؛ الطلبات متاحة لأدوار `owner` و`manager` و`orders`. بعد إرسال الطلب يظهر للعميلة رابط خاص لمتابعة الحالة وسجل تحديثاتها. لا يوجد تسجيل عام للعملاء.

## 4. تشغيل المشروع

```bash
npm run dev
```

افتحي `http://localhost:3000`. يمكن بناء نسخة الإنتاج بـ `npm run build` ثم تشغيلها بـ `npm start`.

## بنية المشروع

```text
src/app/                 صفحات المتجر، الدخول، والداشبورد
src/components/          واجهة المتجر وإدارة المنتجات والطلبات
src/lib/supabase/        عملاء Supabase للمتصفح والسيرفر والتحقق من الإدارة
supabase/migrations/     مخطط قاعدة البيانات وسياساتها وبيانات العرض الأولية
public/hero.png          صورة واجهة المتجر
```

## SEO

- لكل صنف ومنتج صفحة URL مستقلة، وعنوان ووصف وcanonical خاصان به.
- المنتجات تضيف بيانات `Product` المنظمة بالسعر والجنيه المصري واللون والمقاس والتوفر.
- `robots.txt` يسمح بفهرسة المتجر ويستبعد لوحة الإدارة وتسجيل الدخول، و`sitemap.xml` يتضمن الأصناف والمنتجات المنشورة فقط.
- راجعي `NEXT_PUBLIC_SITE_URL` قبل النشر؛ يجب أن يساوي عنوان الدومين العام الفعلي كي لا تشير الروابط الأساسية وملفات SEO إلى `localhost`.

أسعار القطع والأسماء والألوان في migration بيانات أولية للتصميم؛ عدّليها من الداشبورد أو قبل إطلاق المتجر. المخزون غير المتابع مناسب للشغل حسب الطلب. رسوم التوصيل تبدأ بصفر ويمكن ضبطها من **/dashboard/delivery**؛ أما بوابة الدفع الإلكتروني فما زالت تحتاج اختياراً وإعداداً منفصلين قبل استخدامها.
