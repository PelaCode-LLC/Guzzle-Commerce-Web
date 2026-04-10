import React from 'react';
import loadable from '@loadable/component';
import { useIntl } from 'react-intl';

import { useConfiguration } from '../../context/configurationContext';
import { localCategoryCards } from '../../config/localCategories';
import { NamedLink } from '../../components';
import css from './FallbackPage.module.css';

const PageBuilder = loadable(() =>
  import(/* webpackChunkName: "PageBuilder" */ '../PageBuilder/PageBuilder')
);

const CATEGORY_PARAM_NAME = 'pub_categoryLevel1';
const fallbackCategories = localCategoryCards;
const categoryIconById = {
  'cars & trucks': (
    <path d="M7 15l1.6-4.4A2.4 2.4 0 0110.86 9h6.28a2.4 2.4 0 012.26 1.6L21 15M6 17h16M9 17a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zm6 0a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zM8.2 15h7.6" />
  ),
  motorcycles: (
    <path d="M7.5 17.5a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0zm9 0a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0zM10 17.5h6M12 11l2.2 1.8h2.2l1.6 2.2M10.8 11H15l-1.4-2H11" />
  ),
  watercraft: (
    <path d="M5 16.5c1.3 0 1.3.8 2.7.8s1.4-.8 2.8-.8 1.4.8 2.8.8 1.4-.8 2.8-.8 1.4.8 2.8.8 1.5-.8 2.9-.8M7 14h10l-2.1-3.3a1.8 1.8 0 00-1.5-.8H11l-1.5 1.7H7z" />
  ),
  parts: <path d="M10.5 8.5l3-3 2 2-3 3m-2 2l-3 3-2-2 3-3m4-2l2 2m-7 7l8-8" />,
  electronics: (
    <path d="M9 8h6v8H9zM7 10H5m14 0h-2M7 14H5m14 0h-2M10 6V4m4 2V4m-4 14v2m4-2v2" />
  ),
  tools: <path d="M9 8l7 7M8 11l3-3 5 5-3 3-5-5zm8-5l2 2-2.5 2.5-2-2z" />,
  services: (
    <path d="M12 7h6a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V9a2 2 0 012-2h1m3-2l3 3-3 3M9 5h3v6" />
  ),
};

const CategoryIcon = props => {
  const { categoryId } = props;
  const path = categoryIconById[categoryId] || <circle cx="12" cy="12" r="5" />;

  return (
    <svg className={css.categoryIconSvg} viewBox="0 0 24 24" aria-hidden="true">
      {path}
    </svg>
  );
};

// Create fallback content (array of sections) in page asset format:
export const fallbackSections = (error, categories) => ({
  sections: [
    {
      sectionType: 'customHero',
      sectionId: 'landing-hero',
    },
    {
      sectionType: 'customCategories',
      sectionId: 'landing-categories',
      categories,
    },
    ...(error && error?.status !== 404
      ? [
          {
            sectionType: 'customMaintenance',
            sectionId: 'maintenance-mode',
            error,
          },
        ]
      : []),
  ],
  meta: {
    pageTitle: {
      fieldType: 'metaTitle',
      content: 'Home page',
    },
    pageDescription: {
      fieldType: 'metaDescription',
      content: 'Home page fetch failed',
    },
  },
});

const SectionHero = props => {
  const { sectionId } = props;
  const intl = useIntl();

  return (
    <section id={sectionId} className={css.hero}>
      <div className={css.heroGlow} />
      <div className={css.heroContent}>
        <p className={css.heroEyebrow}>
          {intl.formatMessage({ id: 'LandingPage.localHome.heroEyebrow' })}
        </p>
        <h1 className={css.heroTitle}>
          {intl.formatMessage({ id: 'LandingPage.localHome.heroTitle' })}
        </h1>
        <p className={css.heroSubtitle}>
          {intl.formatMessage({ id: 'LandingPage.localHome.heroSubtitle' })}
        </p>

        <div className={css.heroActions}>
          <NamedLink name="SearchPage" className={css.heroPrimaryCta}>
            {intl.formatMessage({ id: 'LandingPage.localHome.heroPrimaryCta' })}
          </NamedLink>
          <NamedLink
            name="SearchPage"
            to={{ search: `?${CATEGORY_PARAM_NAME}=${encodeURIComponent('services')}` }}
            className={css.heroSecondaryCta}
          >
            {intl.formatMessage({ id: 'LandingPage.localHome.heroSecondaryCta' })}
          </NamedLink>
        </div>
      </div>
    </section>
  );
};

// Note: this microcopy/translation does not come from translation file.
//       It needs to be something that is not part of fetched assets but built-in text
const SectionMaintenanceMode = props => {
  const { sectionId, error } = props;
  const intl = useIntl();

  return (
    <section id={sectionId} className={css.errorSection}>
      <div className={css.errorContent}>
        <h2>{intl.formatMessage({ id: 'LandingPage.localHome.errorTitle' })}</h2>
        <p>{error?.message || intl.formatMessage({ id: 'LandingPage.localHome.errorDescription' })}</p>
      </div>
    </section>
  );
};

const SectionCategoryLinks = props => {
  const { sectionId, categories = [] } = props;
  const intl = useIntl();

  const categoryCards = categories.length > 0 ? categories : fallbackCategories;

  return (
    <section id={sectionId} className={css.root}>
      <div className={css.content}>
        <h1 className={css.title}>{intl.formatMessage({ id: 'LandingPage.localHome.title' })}</h1>
        <p className={css.subtitle}>
          {intl.formatMessage({ id: 'LandingPage.localHome.subtitle' })}
        </p>
        <div className={css.categoryGrid}>
          {categoryCards.map(category => {
            const search = `?${CATEGORY_PARAM_NAME}=${encodeURIComponent(category.id)}`;
            const categoryName = category.name || category.label || category.id;

            return (
              <NamedLink
                key={category.id}
                name="SearchPage"
                to={{ search }}
                className={css.categoryCard}
              >
                <span className={css.categoryMain}>
                  <span className={css.categoryIcon}>
                    <CategoryIcon categoryId={category.id} />
                  </span>
                  <span className={css.categoryName}>{categoryName}</span>
                </span>
                <span className={css.categoryAction}>
                  {intl.formatMessage({ id: 'LandingPage.localHome.browse' })}
                </span>
              </NamedLink>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// This is the fallback page, in case there's no Landing Page asset defined in Console.
const FallbackPage = props => {
  const { error, ...rest } = props;
  const config = useConfiguration();
  const categories = config?.categoryConfiguration?.categories || [];

  return (
    <PageBuilder
      pageAssetsData={fallbackSections(error, categories)}
      options={{
        sectionComponents: {
          customHero: { component: SectionHero },
          customMaintenance: { component: SectionMaintenanceMode },
          customCategories: { component: SectionCategoryLinks },
        },
      }}
      {...rest}
    />
  );
};

export default FallbackPage;
