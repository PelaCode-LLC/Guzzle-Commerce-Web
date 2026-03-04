import React from 'react';
import loadable from '@loadable/component';
import { useIntl } from 'react-intl';

import { useConfiguration } from '../../context/configurationContext';
import { NamedLink } from '../../components';
import css from './FallbackPage.module.css';

const PageBuilder = loadable(() =>
  import(/* webpackChunkName: "PageBuilder" */ '../PageBuilder/PageBuilder')
);

const CATEGORY_PARAM_NAME = 'pub_categoryLevel1';
const fallbackCategories = [
  { id: 'cars & trucks', name: 'Cars & Trucks' },
  { id: 'motorcycles', name: 'Motorcycles' },
  { id: 'watercraft', name: 'Watercraft' },
  { id: 'parts', name: 'Parts' },
  { id: 'electronics', name: 'Electronics' },
  { id: 'tools', name: 'Tools' },
  { id: 'services', name: 'Services' },
];

// Create fallback content (array of sections) in page asset format:
export const fallbackSections = (error, categories) => ({
  sections: [
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

            return (
              <NamedLink
                key={category.id}
                name="SearchPage"
                to={{ search }}
                className={css.categoryCard}
              >
                <span className={css.categoryName}>{category.name}</span>
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
          customMaintenance: { component: SectionMaintenanceMode },
          customCategories: { component: SectionCategoryLinks },
        },
      }}
      {...rest}
    />
  );
};

export default FallbackPage;
