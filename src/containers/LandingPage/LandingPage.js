import React, { useEffect, useState } from 'react';
import loadable from '@loadable/component';

import { bool, object } from 'prop-types';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';

import { camelize } from '../../util/string';
import { FormattedMessage } from '../../util/reactIntl';
import { propTypes } from '../../util/types';
import appSettings from '../../config/settings';

import FallbackPage from './FallbackPage';
import { ASSET_NAME } from './LandingPage.duck';
import css from './LandingPage.module.css';

const PageBuilder = loadable(() =>
  import(/* webpackChunkName: "PageBuilder" */ '../PageBuilder/PageBuilder')
);

export const LandingPageComponent = props => {
  const { pageAssetsData, inProgress, error, location, history } = props;
  const [showSignupSuccess, setShowSignupSuccess] = useState(false);

  useEffect(() => {
    if (location?.state?.signupSuccess) {
      setShowSignupSuccess(true);

      const timeoutId = window.setTimeout(() => {
        setShowSignupSuccess(false);
      }, 3500);

      history.replace({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      });

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [history, location]);

  const landingPageData = pageAssetsData?.[camelize(ASSET_NAME)]?.data;
  const shouldShowFallback = !landingPageData && !inProgress && !appSettings.useSharetribeConsole;

  if (shouldShowFallback) {
    return <FallbackPage error={error} />;
  }

  return (
    <>
      {showSignupSuccess ? (
        <div className={css.signupSuccessToast}>
          <FormattedMessage id="LandingPage.signupSuccess" />
        </div>
      ) : null}
      <PageBuilder
        pageAssetsData={landingPageData}
        inProgress={inProgress}
        error={error}
        fallbackPage={<FallbackPage error={error} />}
      />
    </>
  );
};

LandingPageComponent.propTypes = {
  pageAssetsData: object,
  inProgress: bool,
  error: propTypes.error,
};

const mapStateToProps = state => {
  const { pageAssetsData, inProgress, error } = state.hostedAssets || {};
  return { pageAssetsData, inProgress, error };
};

// Note: it is important that the withRouter HOC is **outside** the
// connect HOC, otherwise React Router won't rerender any Route
// components since connect implements a shouldComponentUpdate
// lifecycle hook.
//
// See: https://github.com/ReactTraining/react-router/issues/4671
const LandingPage = compose(withRouter, connect(mapStateToProps))(LandingPageComponent);

export default LandingPage;
