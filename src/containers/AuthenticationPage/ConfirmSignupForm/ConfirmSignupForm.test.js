import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';
import { fakeIntl } from '../../../util/testData';

import TermsAndConditions from '../TermsAndConditions/TermsAndConditions';
import ConfirmSignupForm from './ConfirmSignupForm';

const { screen, fireEvent, userEvent, waitFor } = testingLibrary;

const noop = () => null;

const userTypes = [
  {
    userType: 'a',
    label: 'Seller',
  },
  {
    userType: 'b',
    label: 'Buyer',
  },
  {
    userType: 'c',
    label: 'Guest',
  },
  {
    userType: 'd',
    label: 'Host',
  },
];

const userFields = [
  {
    key: 'enumField1',
    scope: 'public',
    schemaType: 'enum',
    enumOptions: [
      { option: 'o1', label: 'l1' },
      { option: 'o2', label: 'l2' },
      { option: 'o3', label: 'l3' },
    ],
    saveConfig: {
      label: 'Enum Field 1',
      displayInSignUp: true,
      isRequired: false,
    },
    userTypeConfig: {
      limitToUserTypeIds: false,
    },
  },
  {
    key: 'enumField2',
    scope: 'public',
    schemaType: 'enum',
    enumOptions: [
      { option: 'o1', label: 'l1' },
      { option: 'o2', label: 'l2' },
      { option: 'o3', label: 'l3' },
    ],
    saveConfig: {
      label: 'Enum Field 2',
      displayInSignUp: true,
      isRequired: false,
    },
    userTypeConfig: {
      limitToUserTypeIds: true,
      userTypeIds: ['c', 'd'],
    },
  },
  {
    key: 'textField',
    scope: 'private',
    schemaType: 'text',
    saveConfig: {
      label: 'Text Field',
      displayInSignUp: true,
      isRequired: true,
    },
    userTypeConfig: {
      limitToUserTypeIds: false,
    },
  },
  {
    key: 'booleanField',
    scope: 'protected',
    schemaType: 'boolean',
    saveConfig: {
      label: 'Boolean Field',
      displayInSignUp: false,
      isRequired: false,
    },
    userTypeConfig: {
      limitToUserTypeIds: false,
    },
  },
];

const authInfo = {
  idpToken: '123',
  email: 'name@example.com',
  firstName: 'Firstname',
  lastName: 'Lastname',
  idpId: 'idpId',
};

describe('ConfirmSignupForm', () => {
  // Terms and conditions component passed in as props
  const termsAndConditions = (
    <TermsAndConditions onOpenTermsOfService={noop} onOpenPrivacyPolicy={noop} intl={fakeIntl} />
  );

  // // If snapshot testing is preferred, this could be used
  // // However, this form starts to be too big DOM structure to be snapshot tested nicely
  // it('matches snapshot', () => {
  //   const tree = render(
  //     <ConfirmSignupForm intl={fakeIntl} termsAndConditions={termsAndConditions} onSubmit={noop} />
  //   );
  //   expect(tree.asFragment()).toMatchSnapshot();
  // });

  it('enables Continue with button when required fields are filled', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmSignupForm
        authInfo={authInfo}
        intl={fakeIntl}
        termsAndConditions={termsAndConditions}
        userTypes={userTypes}
        userFields={userFields}
        onSubmit={noop}
        onOpenTermsOfService={noop}
      />
    );

    // Check that auth info details are in the form already
    expect(screen.getByRole('textbox', { name: 'ConfirmSignupForm.emailLabel' })).toHaveValue(
      authInfo.email
    );
    expect(screen.getByRole('textbox', { name: 'ConfirmSignupForm.firstNameLabel' })).toHaveValue(
      authInfo.firstName
    );
    expect(screen.getByRole('textbox', { name: 'ConfirmSignupForm.lastNameLabel' })).toHaveValue(
      authInfo.lastName
    );

    fireEvent.click(screen.getByLabelText(/AuthenticationPage.termsAndConditionsAcceptText/i));

    // Continue button should stay enabled with valid form values
    expect(screen.getByRole('button', { name: 'ConfirmSignupForm.signUp' })).toBeEnabled();
  });

  it('does not show custom user fields in confirm signup flow', async () => {
    render(
      <ConfirmSignupForm
        authInfo={authInfo}
        intl={fakeIntl}
        termsAndConditions={termsAndConditions}
        userTypes={userTypes}
        userFields={userFields}
        onSubmit={noop}
        onOpenTermsOfService={noop}
      />
    );

    // Custom user fields are intentionally hidden on signup confirmation.
    expect(screen.queryByText('Enum Field 1')).toBeNull();
    expect(screen.queryByText('Text Field')).toBeNull();
    expect(screen.queryByText('Boolean Field')).toBeNull();
    expect(screen.queryByText('Enum Field 2')).toBeNull();
  });
});
