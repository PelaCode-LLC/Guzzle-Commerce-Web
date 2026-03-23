import React from 'react';

import { requiredFieldArrayCheckbox } from '../../../util/validators';
import { FieldCheckboxGroup, NamedLink } from '../../../components';

import { FormattedMessage, intlShape } from '../../../util/reactIntl';

import css from './TermsAndConditions.module.css';

/**
 * A component that renders the terms and conditions.
 *
 * @component
 * @param {Object} props
 * @param {Function} props.onOpenTermsOfService - The function to open the terms of service modal
 * @param {Function} props.onOpenPrivacyPolicy - The function to open the privacy policy modal
 * @param {string} props.formId - The form id
 * @param {intlShape} props.intl - The intl object
 * @returns {JSX.Element}
 */
const TermsAndConditions = props => {
  const { formId, intl } = props;

  const termsLink = (
    <NamedLink
      className={css.termsLink}
      name="TermsOfServicePage"
      target="_blank"
      rel="noopener noreferrer"
    >
      <FormattedMessage id="AuthenticationPage.termsAndConditionsTermsLinkText" />
    </NamedLink>
  );

  const privacyLink = (
    <NamedLink
      className={css.privacyLink}
      name="PrivacyPolicyPage"
      target="_blank"
      rel="noopener noreferrer"
    >
      <FormattedMessage id="AuthenticationPage.termsAndConditionsPrivacyLinkText" />
    </NamedLink>
  );

  return (
    <div className={css.root}>
      <FieldCheckboxGroup
        name="terms"
        id={formId ? `${formId}.terms-accepted` : 'terms-accepted'}
        optionLabelClassName={css.finePrint}
        options={[
          {
            key: 'tos-and-privacy',
            label: intl.formatMessage(
              { id: 'AuthenticationPage.termsAndConditionsAcceptText' },
              { termsLink, privacyLink }
            ),
          },
        ]}
        validate={requiredFieldArrayCheckbox(
          intl.formatMessage({ id: 'AuthenticationPage.termsAndConditionsAcceptRequired' })
        )}
      />
    </div>
  );
};

export default TermsAndConditions;
