# مكرمية — متجر Next.js + Supabase

مشروع متجر عربي RTL لمكرميات وستائر يدوية، مبني بـ **Next.js App Router وTypeScript وSupabase**. فيه واجهة المتجر، طلبات العملاء، لوحة إدارة محمية، رفع صور المنتجات وتحديث حالات الطلبات.

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
```

قبل النشر، غيّري `NEXT_PUBLIC_SITE_URL` إلى رابط الدومين النهائي بصيغة `https://...`؛ يُستخدم للروابط الأساسية وملفي sitemap وrobots وبيانات المشاركة المنظمة.

## 2. تهيئة قاعدة Supabase

من مجلد المشروع، اربطي Supabase CLI بمشروعك ثم طبّقي migration قاعدة البيانات:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

أو افتحي `supabase/migrations/202611040001_initial_schema.sql` وانسخي محتواه إلى **SQL Editor** في لوحة Supabase وشغّليه مرة واحدة. الـ migration ينشئ المنتجات والطلبات وبنودها، صلاحيات RLS، دالة إنشاء طلب تحسب السعر من قاعدة البيانات، وbucket عام لصور المنتجات بسياسة رفع للإدارة فقط. كما يضيف منتجات تجريبية قابلة للتعديل والحذف.

## 3. إنشاء حساب صاحبة المتجر

من Supabase **Authentication → Users → Add user**، أنشئي مستخدماً بالبريد وكلمة مرور تختاريهما. بعدها شغّلي هذا الاستعلام من **SQL Editor** بعد استبدال البريد:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'owner@example.com'
on conflict (user_id) do nothing;
```

تسجيل الدخول متاح في `/login`، والداشبورد في `/dashboard`. لا يوجد تسجيل عام للعملاء.

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

أسعار القطع والأسماء والألوان في migration بيانات أولية للتصميم؛ عدّليها من الداشبورد أو قبل إطلاق المتجر. المخزون غير المتابع مناسب للشغل حسب الطلب، واختيار متابعة المخزون يخفض الكمية تلقائياً عند قبول الطلب ويرفض الطلبات فوق المتاح. رسوم الشحن حالياً صفر في قاعدة البيانات وتظهر للعميلة كرسوم سيتم تأكيدها معها. أضيفي لاحقاً حساب الشحن وطريقة الدفع التي تختارينها قبل الإطلاق التجاري.
