import React from 'react';
import { FormattedMessage } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import loadable from '@loadable/component';

const SectionBuilder = loadable(
  () => import(/* webpackChunkName: "SectionBuilder" */ '../PageBuilder/PageBuilder'),
  {
    resolveComponent: components => components.SectionBuilder,
  }
);

const FooterComponent = () => {
  const { footer = {}, topbar, marketplaceName } = useConfiguration();

  // If footer asset is not set, show a local fallback footer.
  if (Object.keys(footer).length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '20px 24px 28px',
        }}
      >
        <div style={{ marginBottom: '6px' }}>{marketplaceName}</div>
        <FormattedMessage id="FooterContainer.slogan" />
      </div>
    );
  }

  // The footer asset does not specify sectionId or sectionType. However, the SectionBuilder
  // expects sectionId and sectionType in order to identify the section. We add those
  // attributes here before passing the asset to SectionBuilder.
  const footerSection = {
    ...footer,
    sectionId: 'footer',
    sectionType: 'footer',
    linkLogoToExternalSite: topbar?.logoLink,
  };

  return (
    <>
      <SectionBuilder sections={[footerSection]} />
      <div
        style={{
          textAlign: 'center',
          padding: '12px 24px 24px',
        }}
      >
        <FormattedMessage id="FooterContainer.slogan" />
      </div>
    </>
  );
};

// NOTE: if you want to add dynamic data to FooterComponent,
//       you could just connect this FooterContainer to Redux Store
//
// const mapStateToProps = state => {
//   const { currentUser } = state.user;
//   return { currentUser };
// };
// const FooterContainer = compose(connect(mapStateToProps))(FooterComponent);
// export default FooterContainer;

export default FooterComponent;
