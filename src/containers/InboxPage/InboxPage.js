import React, { useEffect, useState } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import { compose } from 'redux';
import { connect } from 'react-redux';
import classNames from 'classnames';

import { useConfiguration } from '../../context/configurationContext';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';

import { FormattedMessage, intlShape, useIntl } from '../../util/reactIntl';
import { parse } from '../../util/urlHelpers';
import { formatDateWithProximity } from '../../util/dates';
import {
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

const backendConversationSearchParams = (search, conversation) => {
  return {
    ...search,
    ...(conversation ? { conversation: String(conversation) } : {}),
  };
};

const DirectConversationItem = props => {
  const { conversation, isSelected, onSelect, intl } = props;
  const otherUser = toBackendInboxUser(conversation.otherUser);
  const todayString = intl.formatMessage({ id: 'InboxPage.today' });
  const formattedDate = formatDateWithProximity(
    new Date(conversation.lastMessage.createdAt),
    intl,
    todayString
  );
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
          <div className={css.itemTitle}>{conversation.lastMessage.content}</div>
          <div className={css.itemDetails}>{formattedDate}</div>
        </div>
      </button>
    </li>
  );
};

const DirectThreadMessage = props => {
  const { message, isOwn, intl } = props;
  const sender = toBackendInboxUser(message.sender);
  const todayString = intl.formatMessage({ id: 'InboxPage.today' });
  const formattedDate = formatDateWithProximity(new Date(message.createdAt), intl, todayString);

  return (
    <div className={isOwn ? css.directThreadOwnMessage : css.directThreadMessage}>
      {!isOwn ? (
        <div className={css.directThreadAvatar}>
          <Avatar user={sender} disableProfileLink />
        </div>
      ) : null}
      <div className={isOwn ? css.directThreadOwnBubble : css.directThreadBubble}>
        <p className={css.directThreadContent}>{message.content}</p>
        <p className={css.directThreadDate}>{formattedDate}</p>
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
  const title = intl.formatMessage({ id: 'InboxPage.title' });
  const search = parse(location.search);
  const token = getStoredJwt();
  const isBackendInboxMode = !!token;
  const [backendConversations, setBackendConversations] = useState([]);
  const [backendThreadMessages, setBackendThreadMessages] = useState([]);
  const [backendFetchError, setBackendFetchError] = useState(null);
  const [backendFetchInProgress, setBackendFetchInProgress] = useState(false);
  const [backendThreadInProgress, setBackendThreadInProgress] = useState(false);
  const [backendSendInProgress, setBackendSendInProgress] = useState(false);
  const [backendSendError, setBackendSendError] = useState(null);
  const selectedConversationId = Number(search.conversation);
  const selectedConversation = backendConversations.find(
    conversation => conversation.otherUser.id === selectedConversationId
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
    if (!isBackendInboxMode || !selectedConversationId) {
      setBackendThreadMessages([]);
      return undefined;
    }

    let isMounted = true;
    setBackendThreadInProgress(true);

    fetchMessageThreadBackend(token, {
      otherUserId: selectedConversationId,
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
  }, [isBackendInboxMode, selectedConversationId, token]);

  const handleBackendConversationSelect = otherUserId => {
    const nextSearchParams = backendConversationSearchParams(search, otherUserId);
    const nextPath = createResourceLocatorString('InboxPage', routeConfiguration, { tab }, nextSearchParams);
    history.push(nextPath);
  };

  const refreshBackendInbox = () => {
    return fetchInboxBackend(token, {}).then(response => {
      setBackendConversations(response?.conversations || []);
      return response;
    });
  };

  const refreshBackendThread = otherUserId => {
    return fetchMessageThreadBackend(token, {
      otherUserId,
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
      transactionId: null,
    })
      .then(() => Promise.all([
        refreshBackendInbox(),
        refreshBackendThread(selectedConversation.otherUser.id),
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
          </>
        }
        footer={<FooterContainer />}
      >
        <InboxSearchForm
          onSubmit={() => {}}
          onSelect={handleSortSelect(tab, routeConfiguration, history)}
          intl={intl}
          tab={tab}
          routeConfiguration={routeConfiguration}
          history={history}
        />
        {fetchOrdersOrSalesError || backendFetchError ? (
          <p className={css.error}>
            <FormattedMessage id="InboxPage.fetchFailed" />
          </p>
        ) : null}
        {isBackendInboxMode ? (
          <>
            <ul className={css.itemList}>
              {!backendFetchInProgress ? (
                backendConversations.map(conversation => (
                  <DirectConversationItem
                    key={conversation.otherUser.id}
                    conversation={conversation}
                    isSelected={selectedConversationId === conversation.otherUser.id}
                    onSelect={() => handleBackendConversationSelect(conversation.otherUser.id)}
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

            {selectedConversation ? (
              <div className={css.directThreadPanel}>
                <h3 className={css.directThreadHeading}>
                  <FormattedMessage
                    id="InboxPage.conversationWith"
                    values={{ otherUserName: toDisplayName(selectedConversation.otherUser) }}
                  />
                </h3>
                <div className={css.directThreadList}>
                  {!backendThreadInProgress ? (
                    backendThreadMessages.map(message => (
                      <DirectThreadMessage
                        key={message.id}
                        message={message}
                        isOwn={message.sender?.id === currentUserBackendId}
                        intl={intl}
                      />
                    ))
                  ) : (
                    <div className={css.listItemsLoading}>
                      <IconSpinner />
                    </div>
                  )}
                </div>
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
            ) : hasBackendConversations ? (
              <div className={css.directThreadEmptyState}>
                <FormattedMessage id="InboxPage.selectConversation" />
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
