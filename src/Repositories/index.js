import React from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

import Issues from '../Issues';
import Loading from '../Loading';

import './style.css';

const doFetchMore = (fetchMore, cursor) => fetchMore({
  // query: ... (you can specify a different query, otherwise your previous quert is used)
  variables: {
    cursor,
  },
  updateQuery: (previousResult, { fetchMoreResult }) => {
    if (!fetchMoreResult) {
      return previousResult;
    }

    return {
      ...previousResult,
      organization: {
        ...previousResult.organization,
        repositories: {
          ...previousResult.organization.repositories,
          ...fetchMoreResult.organization.repositories,
          edges: [
            ...previousResult.organization.repositories.edges,
            ...fetchMoreResult.organization.repositories.edges,
          ],
        }
      }
    }
  },
});

const Repositories = ({
  loading,
  organization: {
    login,
    repositories,
  },
  fetchMore,
  onWatchToggle,
}) =>
  <div>
    <FetchMoreButton
      loading={loading}
      pageInfo={repositories.pageInfo}
      fetchMore={fetchMore}
    />

    <div>
      {repositories.edges.map(repository =>
        <div key={repository.node.id}>
          <Repository
            { ...repository.node }
            onWatchToggle={onWatchToggle}
          />
          <Issues
            organizationLogin={login}
            repositoryName={repository.node.name}
          />
          <hr />
        </div>
      )}
    </div>
  </div>

const Repository = ({
  id,
  name,
  url,
  description,
  stargazers,
  forks,
  watchers,
  viewerSubscription,
  viewerHasStarred,
  onWatchToggle
}) =>
  <div className="Repository">
    <h2><a href={url}>{name}</a></h2>

    <p>{description}</p>

    <div className="Repository-details">
      <p>Stars: {stargazers.totalCount}</p>
      <p>Forks: {forks.totalCount}</p>

      {viewerSubscription === 'SUBSCRIBED'
        ? (
            <button
              onClick={() => onWatchToggle(id, 'UNSUBSCRIBED')}
              type="button"
            >
              {watchers.totalCount} Unwatch
            </button>
        ) : (
          <button
            onClick={() => onWatchToggle(id, 'SUBSCRIBED')}
            type="button"
          >
            {watchers.totalCount} Watch
          </button>
        )
      }
    </div>
  </div>

const FetchMoreButton = ({
  loading,
  pageInfo,
  fetchMore,
}) =>
  <div>
    {
      loading ? (
        <Loading />
      ) : (
        <button
          onClick={() => doFetchMore(fetchMore, pageInfo.endCursor)}
          type="button"
          disabled={!pageInfo.hasNextPage}
        >
          More
        </button>
      )
    }
  </div>

const REPOSITORY_FRAGMENT = gql`
  fragment repository on Repository {
    id
    name
    url
    description
    stargazers {
      totalCount
    }
    viewerHasStarred
    forks {
      totalCount
    }
    watchers {
      totalCount
    }
    viewerSubscription
  }
`

const WATCH_REPOSITORY = gql`
  mutation ($id: ID!, $isWatch: SubscriptionState!) {
    updateSubscription(input:{state: $isWatch, subscribableId: $id}) {
      subscribable {
        id
        viewerSubscription
      }
    }
  }
`

const WATCH_REPOSITORY_CONFIG = {
  name: 'watchRepository',
  props: ({ watchRepository }) => ({
    onWatchToggle(id, isWatch) {
      watchRepository({
        variables: { id, isWatch },
        optimisticResponse: {
          updateSubscription: {
            __typename: 'Mutation',
            subscribable: {
              __typename: 'Repository',
              id,
              viewerSubscription: isWatch,
            }
          }
        },
      })
    },
  }),
  options: {
    update: (proxy, props) => {
      const { id, viewerSubscription } = props.data.updateSubscription.subscribable;

      const fragment = proxy.readFragment({
        id: `Repository:${id}`,
        fragment: REPOSITORY_FRAGMENT,
      });

      let { totalCount } = fragment.watchers;
      totalCount = viewerSubscription === 'SUBSCRIBED'
        ? totalCount + 1
        : totalCount - 1;

      proxy.writeFragment({
        id: `Repository:${id}`,
        fragment: REPOSITORY_FRAGMENT,
        data: {
          ...fragment,
          watchers: {
            ...fragment.watchers,
            totalCount,
          }
        },
      });
    },
  }
};

export {
  REPOSITORY_FRAGMENT,
};

export default graphql(
  WATCH_REPOSITORY,
  WATCH_REPOSITORY_CONFIG
)(Repositories);