import React from 'react';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';

import { IconAlert, Modal, Button } from '../../../components';

import css from './DeleteListingModal.module.css';

/**
 * Delete listing modal
 *
 * @param {Object} props
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {string} [props.rootClassName] - Custom class that overrides the default class for the root element
 * @param {string} props.id - The id of the modal
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {function} props.onCloseModal - The function to close the modal
 * @param {function} props.onManageDisableScrolling - The function to manage disable scrolling
 * @param {function} props.onDeleteListing - The function to delete the listing
 * @returns {JSX.Element} Delete listing modal component
 */
const DeleteListingModal = props => {
  const intl = useIntl();
  const {
    className,
    rootClassName,
    id,
    isOpen,
    focusElementId,
    onCloseModal,
    onManageDisableScrolling,
    onDeleteListing,
  } = props;
  const classes = classNames(rootClassName || css.root, className);

  return (
    <Modal
      id={id}
      containerClassName={classes}
      contentClassName={css.modalContent}
      isOpen={isOpen}
      onClose={onCloseModal}
      onManageDisableScrolling={onManageDisableScrolling}
      focusElementId={focusElementId}
      usePortal
      closeButtonMessage={intl.formatMessage({ id: 'DeleteListingModal.close' })}
    >
      <IconAlert className={css.modalIcon} />
      <p className={css.modalTitle}>
        <FormattedMessage id="DeleteListingModal.title" />
      </p>
      <p className={css.modalMessage}>
        <FormattedMessage id="DeleteListingModal.message" />
      </p>
      <Button onClick={onDeleteListing} className={css.submitButton}>
        <FormattedMessage id="DeleteListingModal.submit" />
      </Button>
    </Modal>
  );
};

export default DeleteListingModal;
