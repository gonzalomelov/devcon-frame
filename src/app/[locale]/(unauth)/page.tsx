import { getTranslations } from 'next-intl/server';

export async function generateMetadata(props: { params: { locale: string } }) {
  const t = await getTranslations({
    locale: props.params.locale,
    namespace: 'Index',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default function Index() {
  return (
    <p>
      <a
        className="text-blue-700 hover:border-b-2 hover:border-blue-700"
        href="https://raffle.devcon.org"
      >
        Devcon 7 Raffle
      </a>{' '}
    </p>
  );
}
