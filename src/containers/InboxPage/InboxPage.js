import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import { compose } from 'redux';
import { connect } from 'react-redux';
import classNames from 'classnames';

import { useConfiguration } from '../../context/configurationContext';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';

import { FormattedMessage, intlShape, useIntl } from '../../util/reactIntl';
import { parse } from '../../util/urlHelpers';
import IconInquiry from '../../components/IconInquiry/IconInquiry';
import {
  deleteConversationBackend,
  fetchInboxBackend,
  fetchMessageThreadBackend,
  sendMessageBackend,
  toBackendIdFromUuid,
  toUuidFromBackendId,
} from '../../util/backend';
import {
  propTypes,
  DATE_TYPE_DATE,
  DATE_TYPE_DATETIME,
  LINE_ITEM_DAY,
  LINE_ITEM_HOUR,
  LISTING_UNIT_TYPES,
  STOCK_MULTIPLE_ITEMS,
  AVAILABILITY_MULTIPLE_SEATS,
  LINE_ITEM_FIXED,
} from '../../util/types';
import { subtractTime } from '../../util/dates';
import { createResourceLocatorString } from '../../util/routes';
import {
  TX_TRANSITION_ACTOR_CUSTOMER,
  TX_TRANSITION_ACTOR_PROVIDER,
  resolveLatestProcessName,
  getProcess,
  isBookingProcess,
  isPurchaseProcess,
  isNegotiationProcess,
} from '../../transactions/transaction';

import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import {
  H2,
  Avatar,
  NamedLink,
  NotificationBadge,
  Page,
  PaginationLinks,
  InlineTextButton,
  IconDelete,
  IconSpinner,
  TimeRange,
  UserDisplayName,
  LayoutSideNavigation,
} from '../../components';

import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';
import NotFoundPage from '../../containers/NotFoundPage/NotFoundPage';
import SendMessageForm from '../../containers/TransactionPage/SendMessageForm/SendMessageForm';
import InboxSearchForm from './InboxSearchForm/InboxSearchForm';

import { stateDataShape, getStateData } from './InboxPage.stateData';
import css from './InboxPage.module.css';

const getStoredJwt = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem('jwt');
};

const abbreviateName = name => {
  if (!name) {
    return 'U';
  }

  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);
};

const toDisplayName = user => {
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || `User ${user?.id || ''}`.trim();
};

const toBackendInboxUser = user => {
  const displayName = toDisplayName(user);

  return {
    id: { uuid: toUuidFromBackendId(user?.id || 1) },
    type: 'user',
    attributes: {
      profile: {
        displayName,
        abbreviatedName: abbreviateName(displayName),
      },
      banned: false,
      deleted: false,
    },
  };
};

// Relative time: "just now", "2 min ago", "Yesterday 3:42 PM", etc.
const formatRelativeTime = (date, intl) => {
  const nowMs = Date.now();
  const diffMs = nowMs - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) {
    return intl.formatMessage({ id: 'InboxPage.timeJustNow' });
  }
  if (diffMin < 60) {
    return intl.formatMessage({ id: 'InboxPage.timeMinutesAgo' }, { count: diffMin });
  }
  if (diffHour < 24) {
    return intl.formatMessage({ id: 'InboxPage.timeHoursAgo' }, { count: diffHour });
  }

  // Yesterday
  const yesterday = new Date(nowMs - 86400000);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    const timeStr = intl.formatDate(date, { hour: 'numeric', minute: 'numeric' });
    return `${intl.formatMessage({ id: 'InboxPage.timeYesterday' })} ${timeStr}`;
  }

  // Older: "Apr 7, 3:42 PM"
  return intl.formatDate(date, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
};

const backendConversationSearchParams = (search, conversationKey) => {
  const { conversation, ...restSearch } = search;

  return {
    ...restSearch,
    ...(conversationKey ? { conversation: String(conversationKey) } : {}),
  };
};

const DirectConversationItem = props => {
  const { conversation, isSelected, onSelect, intl } = props;
  const otherUser = toBackendInboxUser(conversation.otherUser);
  const formattedDate = formatRelativeTime(
    new Date(conversation.lastMessage.createdAt),
    intl
  );
  const listingTitle = conversation.listing?.title;
  const itemClasses = classNames(css.directConversationButton, {
    [css.directConversationButtonSelected]: isSelected,
  });

  return (
    <li className={css.listItem}>
      <button type="button" className={itemClasses} onClick={onSelect}>
        <div className={css.itemAvatar}>
          <Avatar user={otherUser} disableProfileLink />
        </div>
        <div className={css.directConversationContent}>
          <div className={css.directConversationHeaderRow}>
            <div className={css.itemUsername}>
              <UserDisplayName user={otherUser} intl={intl} />
            </div>
            {conversation.unreadCount > 0 ? (
              <NotificationBadge count={conversation.unreadCount} />
            ) : null}
          </div>
          <div className={css.itemTitle}>{listingTitle || conversation.lastMessage.content}</div>
          <div className={css.directConversationMetaRow}>
            <div className={css.itemDetails}>
              {listingTitle ? conversation.lastMessage.content : formattedDate}
            </div>
            {listingTitle ? (
              <div className={css.directConversationTimestamp}>{formattedDate}</div>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  );
};

const DirectThreadMessage = props => {
  const { message, isOwn, isFirst, isLast, intl } = props;
  const sender = toBackendInboxUser(message.sender);
  const formattedDate = formatRelativeTime(new Date(message.createdAt), intl);

  // Adjust border-radius for grouped consecutive messages
  const ownRadius = isLast ? '14px 14px 4px 14px' : isFirst ? '14px 14px 4px 14px' : '14px 14px 4px 14px';
  const bubbleStyle = isOwn
    ? {
        borderRadius: isFirst && isLast
          ? '14px 14px 4px 14px'
          : isFirst
          ? '14px 14px 4px 4px'
          : isLast
          ? '4px 14px 14px 4px'
          : '4px 14px 4px 4px',
      }
    : {
        borderRadius: isFirst && isLast
          ? '14px 14px 14px 4px'
          : isFirst
          ? '14px 14px 4px 4px'
          : isLast
          ? '4px 4px 14px 14px'
          : '4px 4px 4px 4px',
      };

  const messageClasses = classNames(
    isOwn ? css.directThreadOwnMessage : css.directThreadMessage,
    { [css.directThreadMessageGrouped]: !isFirst }
  );

  return (
    <div className={messageClasses}>
      {!isOwn ? (
        <div className={classNames(css.directThreadAvatar, { [css.directThreadAvatarHidden]: !isLast })}>
          {isLast ? <Avatar user={sender} disableProfileLink /> : null}
        </div>
      ) : null}
      <div
        className={isOwn ? css.directThreadOwnBubble : css.directThreadBubble}
        style={bubbleStyle}
      >
        <p className={css.directThreadContent}>{message.content}</p>
        {isLast ? <p className={css.directThreadDate}>{formattedDate}</p> : null}
      </div>
    </div>
  );
};

// Check if the transaction line-items use booking-related units
const getUnitLineItem = lineItems => {
  const unitLineItem = lineItems?.find(
    item => LISTING_UNIT_TYPES.includes(item.code) && !item.reversal
  );
  return unitLineItem;
};

// Booking data (start & end) are bit different depending on display times and
// if "end" refers to last day booked or the first exclusive day
const bookingData = (tx, lineItemUnitType, timeZone) => {
  // Attributes: displayStart and displayEnd can be used to differentiate shown time range
  // from actual start and end times used for availability reservation. It can help in situations
  // where there are preparation time needed between bookings.
  // Read more: https://www.sharetribe.com/api-reference/marketplace.html#bookings
  const { start, end, displayStart, displayEnd } = tx.booking.attributes;
  const bookingStart = displayStart || start;
  const bookingEndRaw = displayEnd || end;

  // LINE_ITEM_DAY uses exclusive end day, so we subtract one day from the end date
  const isDayBooking = [LINE_ITEM_DAY].includes(lineItemUnitType);
  const bookingEnd = isDayBooking
    ? subtractTime(bookingEndRaw, 1, 'days', timeZone)
    : bookingEndRaw;

  return { bookingStart, bookingEnd };
};

const BookingTimeInfoMaybe = props => {
  const { transaction, ...rest } = props;
  const processName = resolveLatestProcessName(transaction?.attributes?.processName);
  const process = getProcess(processName);
  const isInquiry = process.getState(transaction) === process.states.INQUIRY;

  if (isInquiry) {
    return null;
  }

  const hasLineItems = transaction?.attributes?.lineItems?.length > 0;
  const unitLineItem = hasLineItems
    ? transaction.attributes?.lineItems?.find(
        item => LISTING_UNIT_TYPES.includes(item.code) && !item.reversal
      )
    : null;

  const lineItemUnitType = unitLineItem ? unitLineItem.code : null;
  const dateType = [LINE_ITEM_HOUR, LINE_ITEM_FIXED].includes(lineItemUnitType)
    ? DATE_TYPE_DATETIME
    : DATE_TYPE_DATE;

  const timeZone = transaction?.listing?.attributes?.availabilityPlan?.timezone || 'Etc/UTC';
  const { bookingStart, bookingEnd } = bookingData(transaction, lineItemUnitType, timeZone);

  return (
    <TimeRange
      startDate={bookingStart}
      endDate={bookingEnd}
      dateType={dateType}
      timeZone={timeZone}
      {...rest}
    />
  );
};

// Build and push path string for routing - based on sort selection as selected in InboxSearchForm
const handleSortSelect = (tab, routeConfiguration, history) => urlParam => {
  const pathParams = {
    tab: tab,
  };
  const searchParams = {
    sort: urlParam,
  };

  const sortPath = createResourceLocatorString(
    'InboxPage',
    routeConfiguration,
    pathParams,
    searchParams
  );

  history.push(sortPath);
};

/**
 * The InboxItem component.
 *
 * @component
 * @param {Object} props
 * @param {TX_TRANSITION_ACTOR_CUSTOMER | TX_TRANSITION_ACTOR_PROVIDER} props.transactionRole - The transaction role
 * @param {propTypes.transaction} props.tx - The transaction
 * @param {intlShape} props.intl - The intl object
 * @param {stateDataShape} props.stateData - The state data
 * @returns {JSX.Element} inbox item component
 */
export const InboxItem = props => {
  const {
    transactionRole,
    tx,
    intl,
    stateData,
    isBooking,
    isPurchase,
    availabilityType,
    stockType = STOCK_MULTIPLE_ITEMS,
  } = props;
  const { customer, provider, listing } = tx;
  const {
    processName,
    processState,
    actionNeeded,
    isSaleNotification,
    isOrderNotification,
    isFinal,
  } = stateData;
  const isCustomer = transactionRole === TX_TRANSITION_ACTOR_CUSTOMER;

  const lineItems = tx.attributes?.lineItems;
  const hasPricingData = lineItems.length > 0;
  const unitLineItem = getUnitLineItem(lineItems);
  const quantity = hasPricingData && isPurchase ? unitLineItem.quantity.toString() : null;
  const showStock = stockType === STOCK_MULTIPLE_ITEMS || (quantity && unitLineItem.quantity > 1);
  const otherUser = isCustomer ? provider : customer;
  const otherUserDisplayName = <UserDisplayName user={otherUser} intl={intl} />;
  const isOtherUserBanned = otherUser.attributes.banned;

  const rowNotificationDot =
    isSaleNotification || isOrderNotification ? <div className={css.notificationDot} /> : null;

  const linkClasses = classNames(css.itemLink, {
    [css.bannedUserLink]: isOtherUserBanned,
  });
  const stateClasses = classNames(css.stateName, {
    [css.stateConcluded]: isFinal,
    [css.stateActionNeeded]: actionNeeded,
    [css.stateNoActionNeeded]: !actionNeeded,
  });

  return (
    <div className={css.item}>
      <div className={css.itemAvatar}>
        <Avatar user={otherUser} />
      </div>
      <NamedLink
        className={linkClasses}
        name={isCustomer ? 'OrderDetailsPage' : 'SaleDetailsPage'}
        params={{ id: tx.id.uuid }}
      >
        <div className={css.rowNotificationDot}>{rowNotificationDot}</div>
        <div className={css.itemUsername}>{otherUserDisplayName}</div>
        <div className={css.itemTitle}>{listing?.attributes?.title}</div>
        <div className={css.itemDetails}>
          {isBooking ? (
            <BookingTimeInfoMaybe transaction={tx} />
          ) : isPurchase && hasPricingData && showStock ? (
            <FormattedMessage id="InboxPage.quantity" values={{ quantity }} />
          ) : null}
        </div>
        {availabilityType == AVAILABILITY_MULTIPLE_SEATS && unitLineItem?.seats ? (
          <div className={css.itemSeats}>
            <FormattedMessage id="InboxPage.seats" values={{ seats: unitLineItem.seats }} />
          </div>
        ) : null}
        <div className={css.itemState}>
          <div className={stateClasses}>
            <FormattedMessage
              id={`InboxPage.${processName}.${processState}.status`}
              values={{ transactionRole }}
            />
          </div>
        </div>
      </NamedLink>
    </div>
  );
};

/**
 * The InboxPage component.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.currentUser - The current user
 * @param {boolean} props.fetchInProgress - Whether the fetch is in progress
 * @param {propTypes.error} props.fetchOrdersOrSalesError - The fetch orders or sales error
 * @param {propTypes.pagination} props.pagination - The pagination object
 * @param {Object} props.params - The params object
 * @param {string} props.params.tab - The tab
 * @param {number} props.providerNotificationCount - The provider notification count
 * @param {number} props.customerNotificationCount - The customer notification count
 * @param {boolean} props.scrollingDisabled - Whether scrolling is disabled
 * @param {Array<propTypes.transaction>} props.transactions - The transactions array
 * @param {Object} props.intl - The intl object
 * @returns {JSX.Element} inbox page component
 */
export const InboxPageComponent = props => {
  const config = useConfiguration();
  const routeConfiguration = useRouteConfiguration();
  const history = useHistory();
  const intl = useIntl();
  const location = useLocation();
  const {
    currentUser,
    fetchInProgress,
    fetchOrdersOrSalesError,
    pagination,
    params,
    scrollingDisabled,
    transactions,
  } = props;
  const { tab } = params;
  const validTab = tab === 'orders' || tab === 'sales';
  if (!validTab) {
    return <NotFoundPage staticContext={props.staticContext} />;
  }

  const isOrders = tab === 'orders';
  const hasNoResults = !fetchInProgress && transactions.length === 0 && !fetchOrdersOrSalesError;
  const search = parse(location.search);
  const token = getStoredJwt();
  const isBackendInboxMode = !!token;
  const [backendConversations, setBackendConversations] = useState([]);
  const [backendThreadMessages, setBackendThreadMessages] = useState([]);
  const [backendFetchError, setBackendFetchError] = useState(null);
  const [backendFetchInProgress, setBackendFetchInProgress] = useState(false);
  const [backendThreadInProgress, setBackendThreadInProgress] = useState(false);
  const [backendDeleteInProgress, setBackendDeleteInProgress] = useState(false);
  const [backendSendInProgress, setBackendSendInProgress] = useState(false);
  const [backendSendError, setBackendSendError] = useState(null);
  const threadScrollRef = useRef(null);

  // Compute total unread for page title badge
  const totalUnread = backendConversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const title = totalUnread > 0
    ? `(${totalUnread}) ${intl.formatMessage({ id: 'InboxPage.title' })}`
    : intl.formatMessage({ id: 'InboxPage.title' });
  const selectedConversationKey = search.conversation || '';
  const legacySelectedConversationId = Number(search.conversation);
  const selectedConversation =
    backendConversations.find(conversation => conversation.key === selectedConversationKey) ||
    backendConversations.find(
      conversation =>
        conversation.scopeType === 'direct' && conversation.otherUser.id === legacySelectedConversationId
    );
  const currentUserBackendId = currentUser?.id ? toBackendIdFromUuid(currentUser.id) : null;

  useEffect(() => {
    if (!isBackendInboxMode) {
      return undefined;
    }

    let isMounted = true;
    setBackendFetchInProgress(true);
    setBackendFetchError(null);

    fetchInboxBackend(token, {})
      .then(response => {
        if (isMounted) {
          setBackendConversations(response?.conversations || []);
        }
      })
      .catch(error => {
        if (isMounted) {
          setBackendFetchError(error);
        }
      })
      .finally(() => {
        if (isMounted) {
          setBackendFetchInProgress(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isBackendInboxMode, token]);

  useEffect(() => {
    if (!isBackendInboxMode || !selectedConversation) {
      setBackendThreadMessages([]);
      return undefined;
    }

    let isMounted = true;
    setBackendThreadInProgress(true);

    fetchMessageThreadBackend(token, {
      otherUserId: selectedConversation.otherUser.id,
      transactionId: selectedConversation.transactionId,
      listingId: selectedConversation.listing?.id,
      limit: 100,
      offset: 0,
    })
      .then(response => {
        if (isMounted) {
          setBackendThreadMessages(response?.messages || []);
        }
      })
      .catch(error => {
        if (isMounted) {
          setBackendFetchError(error);
        }
      })
      .finally(() => {
        if (isMounted) {
          setBackendThreadInProgress(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isBackendInboxMode, selectedConversation, token]);

  useEffect(() => {
    if (!isBackendInboxMode || selectedConversation || backendConversations.length === 0) {
      return;
    }

    const firstConversation = backendConversations[0];
    if (firstConversation?.key) {
      handleBackendConversationSelect(firstConversation);
    }
  }, [isBackendInboxMode, selectedConversation, backendConversations]);

  // Auto-scroll thread list to the bottom whenever messages change
  useEffect(() => {
    if (threadScrollRef.current) {
      threadScrollRef.current.scrollTop = threadScrollRef.current.scrollHeight;
    }
  }, [backendThreadMessages]);

  const handleBackendConversationSelect = conversation => {
    const nextSearchParams = backendConversationSearchParams(search, conversation?.key);
    const nextPath = createResourceLocatorString('InboxPage', routeConfiguration, { tab }, nextSearchParams);
    history.push(nextPath);
  };

  const refreshBackendInbox = () => {
    return fetchInboxBackend(token, {}).then(response => {
      setBackendConversations(response?.conversations || []);
      return response;
    });
  };

  const refreshBackendThread = conversation => {
    return fetchMessageThreadBackend(token, {
      otherUserId: conversation.otherUser.id,
      transactionId: conversation.transactionId,
      listingId: conversation.listing?.id,
      limit: 100,
      offset: 0,
    }).then(response => {
      setBackendThreadMessages(response?.messages || []);
      return response;
    });
  };

  const handleBackendThreadSubmit = (values, formApi) => {
    const content = values?.message?.trim();
    if (!selectedConversation || !content) {
      return Promise.resolve();
    }

    setBackendSendInProgress(true);
    setBackendSendError(null);

    return sendMessageBackend(token, {
      recipientId: selectedConversation.otherUser.id,
      content,
      transactionId: selectedConversation.transactionId,
      listingId: selectedConversation.listing?.id,
    })
      .then(() => Promise.all([
        refreshBackendInbox(),
        refreshBackendThread(selectedConversation),
      ]))
      .then(() => {
        if (formApi?.reset) {
          formApi.reset();
        }
      })
      .catch(error => {
        setBackendSendError(error);
      })
      .finally(() => {
        setBackendSendInProgress(false);
      });
  };

  const clearBackendConversationSelection = () => {
    const nextSearchParams = backendConversationSearchParams(search, null);
    const nextPath = createResourceLocatorString('InboxPage', routeConfiguration, { tab }, nextSearchParams);
    history.push(nextPath);
  };

  const handleBackendConversationDelete = () => {
    if (!selectedConversation || backendDeleteInProgress) {
      return Promise.resolve();
    }

    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            intl.formatMessage({ id: 'InboxPage.deleteConversationConfirm' })
          );

    if (!confirmed) {
      return Promise.resolve();
    }

    setBackendDeleteInProgress(true);
    setBackendFetchError(null);

    return deleteConversationBackend(token, {
      otherUserId: selectedConversation.otherUser.id,
      transactionId: selectedConversation.transactionId,
      listingId: selectedConversation.listing?.id,
    })
      .then(() => refreshBackendInbox())
      .then(response => {
        const remainingConversations = response?.conversations || [];
        const nextConversation = remainingConversations[0];

        setBackendThreadMessages([]);

        if (nextConversation?.key) {
          handleBackendConversationSelect(nextConversation);
        } else {
          clearBackendConversationSelection();
        }
      })
      .catch(error => {
        setBackendFetchError(error);
      })
      .finally(() => {
        setBackendDeleteInProgress(false);
      });
  };

  const pickType = lt => conf => conf.listingType === lt;
  const findListingTypeConfig = publicData => {
    const listingTypeConfigs = config.listing?.listingTypes;
    const { listingType } = publicData || {};
    const foundConfig = listingTypeConfigs?.find(pickType(listingType));
    return foundConfig;
  };
  const toTxItem = tx => {
    const transactionRole = isOrders ? TX_TRANSITION_ACTOR_CUSTOMER : TX_TRANSITION_ACTOR_PROVIDER;
    let stateData = null;
    try {
      stateData = getStateData({ transaction: tx, transactionRole, intl });
    } catch (error) {
      // If stateData is missing, omit the transaction from InboxItem list.
    }

    const publicData = tx?.listing?.attributes?.publicData || {};
    const foundListingTypeConfig = findListingTypeConfig(publicData);
    const { transactionType, stockType, availabilityType } = foundListingTypeConfig || {};
    const process = tx?.attributes?.processName || transactionType?.transactionType;
    const transactionProcess = resolveLatestProcessName(process);
    const isBooking = isBookingProcess(transactionProcess);
    const isPurchase = isPurchaseProcess(transactionProcess);
    const isNegotiation = isNegotiationProcess(transactionProcess);

    // Render InboxItem only if the latest transition of the transaction is handled in the `txState` function.
    return stateData ? (
      <li key={tx.id.uuid} className={css.listItem}>
        <InboxItem
          transactionRole={transactionRole}
          tx={tx}
          intl={intl}
          stateData={stateData}
          stockType={stockType}
          availabilityType={availabilityType}
          isBooking={isBooking}
          isPurchase={isPurchase}
        />
      </li>
    ) : null;
  };

  const hasOrderOrSaleTransactions = (tx, isOrdersTab, user) => {
    return isOrdersTab
      ? user?.id && tx && tx.length > 0 && tx[0].customer.id.uuid === user?.id?.uuid
      : user?.id && tx && tx.length > 0 && tx[0].provider.id.uuid === user?.id?.uuid;
  };
  const hasTransactions =
    !fetchInProgress && hasOrderOrSaleTransactions(transactions, isOrders, currentUser);

  const hasBackendConversations = !backendFetchInProgress && backendConversations.length > 0;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSideNavigation
        sideNavClassName={css.navigation}
        mainColumnClassName={css.mainColumnCompact}
        topbar={
          <TopbarContainer
            mobileRootClassName={css.mobileTopbar}
            desktopClassName={css.desktopTopbar}
          />
        }
        sideNav={
          <>
            <H2 as="h1" className={css.title}>
              <FormattedMessage id="InboxPage.title" />
            </H2>
            {isBackendInboxMode ? (
              <ul className={classNames(css.itemList, css.sideConversationList)}>
                {!backendFetchInProgress ? (
                  backendConversations.map(conversation => (
                    <DirectConversationItem
                      key={conversation.key}
                      conversation={conversation}
                      isSelected={selectedConversation?.key === conversation.key}
                      onSelect={() => handleBackendConversationSelect(conversation)}
                      intl={intl}
                    />
                  ))
                ) : (
                  <li className={css.listItemsLoading}>
                    <IconSpinner />
                  </li>
                )}
                {!hasBackendConversations && !backendFetchInProgress ? (
                  <li key="noResults" className={css.noResults}>
                    <FormattedMessage id="InboxPage.noMessagesFound" />
                  </li>
                ) : null}
              </ul>
            ) : null}
          </>
        }
        footer={<FooterContainer />}
      >
        {!isBackendInboxMode ? (
          <InboxSearchForm
            onSubmit={() => {}}
            onSelect={handleSortSelect(tab, routeConfiguration, history)}
            intl={intl}
            tab={tab}
            routeConfiguration={routeConfiguration}
            history={history}
          />
        ) : null}
        {fetchOrdersOrSalesError || backendFetchError ? (
          <p className={css.error}>
            <FormattedMessage id="InboxPage.fetchFailed" />
          </p>
        ) : null}
        {isBackendInboxMode ? (
          <>
            {selectedConversation ? (
              <div className={css.directThreadPanel}>
                <div className={css.directThreadHeaderRow}>
                  <h3 className={css.directThreadHeading}>
                    <FormattedMessage
                      id={
                        selectedConversation.listing?.title
                          ? 'InboxPage.conversationWithListing'
                          : 'InboxPage.conversationWith'
                      }
                      values={{
                        otherUserName: toDisplayName(selectedConversation.otherUser),
                        listingTitle: selectedConversation.listing?.title,
                      }}
                    />
                  </h3>
                  <InlineTextButton
                    className={css.directThreadDeleteButton}
                    onClick={handleBackendConversationDelete}
                    disabled={backendDeleteInProgress}
                  >
                    <IconDelete />
                    <FormattedMessage id="InboxPage.deleteConversation" />
                  </InlineTextButton>
                </div>
                <div className={css.directThreadList} ref={threadScrollRef}>
                  {!backendThreadInProgress ? (
                    backendThreadMessages.length > 0 ? (
                      backendThreadMessages.map((message, index) => {
                        const prevSenderId =
                          index > 0 ? backendThreadMessages[index - 1].sender?.id : null;
                        const nextSenderId =
                          index < backendThreadMessages.length - 1
                            ? backendThreadMessages[index + 1].sender?.id
                            : null;
                        const isFirst = prevSenderId !== message.sender?.id;
                        const isLast = nextSenderId !== message.sender?.id;
                        return (
                          <DirectThreadMessage
                            key={message.id}
                            message={message}
                            isOwn={message.sender?.id === currentUserBackendId}
                            isFirst={isFirst}
                            isLast={isLast}
                            intl={intl}
                          />
                        );
                      })
                    ) : (
                      <div className={css.directThreadEmptyMessages}>
                        <IconInquiry className={css.directThreadEmptyIcon} />
                        <p className={css.directThreadEmptyText}>
                          <FormattedMessage id="InboxPage.noMessagesYet" />
                        </p>
                      </div>
                    )
                  ) : (
                    <div className={css.listItemsLoading}>
                      <IconSpinner />
                    </div>
                  )}
                </div>
                <div className={css.directThreadComposer}>
                  <SendMessageForm
                    formId="InboxPage.directMessage"
                    messagePlaceholder={intl.formatMessage(
                      { id: 'InboxPage.messagePlaceholder' },
                      { otherUserName: toDisplayName(selectedConversation.otherUser) }
                    )}
                    onSubmit={handleBackendThreadSubmit}
                    inProgress={backendSendInProgress}
                    sendMessageError={backendSendError}
                  />
                </div>
              </div>
            ) : hasBackendConversations ? (
              <div className={css.directThreadEmptyState}>
                <IconInquiry className={css.directThreadEmptyIcon} />
                <p className={css.directThreadEmptyText}>
                  <FormattedMessage id="InboxPage.selectConversation" />
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <ul className={css.itemList}>
              {!fetchInProgress ? (
                transactions.map(toTxItem)
              ) : (
                <li className={css.listItemsLoading}>
                  <IconSpinner />
                </li>
              )}
              {hasNoResults ? (
                <li key="noResults" className={css.noResults}>
                  <FormattedMessage
                    id={isOrders ? 'InboxPage.noOrdersFound' : 'InboxPage.noSalesFound'}
                  />
                </li>
              ) : null}
            </ul>
          </>
        )}
        {!isBackendInboxMode && hasTransactions && pagination && pagination.totalPages > 1 ? (
          <PaginationLinks
            className={css.pagination}
            pageName="InboxPage"
            pagePathParams={params}
            pageSearchParams={search}
            pagination={pagination}
          />
        ) : null}
      </LayoutSideNavigation>
    </Page>
  );
};

const mapStateToProps = state => {
  const { fetchInProgress, fetchOrdersOrSalesError, pagination, transactionRefs } = state.InboxPage;
  const { currentUser } = state.user;
  return {
    currentUser,
    fetchInProgress,
    fetchOrdersOrSalesError,
    pagination,
    scrollingDisabled: isScrollingDisabled(state),
    transactions: getMarketplaceEntities(state, transactionRefs),
  };
};

const InboxPage = compose(connect(mapStateToProps))(InboxPageComponent);

export default InboxPage;
