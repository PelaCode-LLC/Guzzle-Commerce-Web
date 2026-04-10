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
  'cars & trucks': 'CT',
  motorcycles: 'MC',
  watercraft: 'WC',
  parts: 'PT',
  electronics: 'EL',
  tools: 'TL',
  services: 'SV',
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
            const categoryIcon = categoryIconById[category.id] || 'IT';

            return (
              <NamedLink
                key={category.id}
                name="SearchPage"
                to={{ search }}
                className={css.categoryCard}
              >
                <span className={css.categoryMain}>
                  <span className={css.categoryIcon}>{categoryIcon}</span>
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
