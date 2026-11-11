import { SettingsTabs } from "@/components/settings/tabs";

export default async function SettingsLayout({
  children,
  params,
}: LayoutProps<"/w/[slug]/settings">) {
  const { slug } = await params;
  return (
    <>
      <div className="border-border border-b px-4 pt-5 sm:px-8">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <div className="mt-3">
          <SettingsTabs slug={slug} />
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-6 pb-12 sm:px-8">{children}</div>
    </>
  );
}
