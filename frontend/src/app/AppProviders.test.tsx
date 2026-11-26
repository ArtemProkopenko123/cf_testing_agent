import { QueryClient, useQuery } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { useTheme } from 'styled-components'
import { afterEach, describe, expect, it } from 'vitest'
import { theme } from '../design-system'
import { queryClient } from '../lib/queryClient'
import { AppProviders } from './AppProviders'

// Reads only from the cache: the query is disabled, so the fetch never runs.
function CachedGreeting() {
  const { data } = useQuery({
    queryKey: ['greeting'],
    queryFn: () => 'fetched from the network',
    enabled: false,
  })
  return <p>{data ?? 'no greeting'}</p>
}

function ThemeInk() {
  return <p>{useTheme().colors.inkStrong}</p>
}

afterEach(() => {
  queryClient.removeQueries({ queryKey: ['greeting'] })
})

describe('AppProviders', () => {
  it('gives children the query client that was passed in', () => {
    const client = new QueryClient()
    client.setQueryData(['greeting'], 'from the given client')
    render(
      <AppProviders client={client}>
        <CachedGreeting />
      </AppProviders>,
    )
    expect(screen.getByText('from the given client')).toBeInTheDocument()
  })

  it('falls back to the shared app query client when none is passed', () => {
    queryClient.setQueryData(['greeting'], 'from the shared client')
    render(
      <AppProviders>
        <CachedGreeting />
      </AppProviders>,
    )
    expect(screen.getByText('from the shared client')).toBeInTheDocument()
  })

  it('provides the design-system theme to styled children', () => {
    render(
      <AppProviders client={new QueryClient()}>
        <ThemeInk />
      </AppProviders>,
    )
    expect(screen.getByText(theme.colors.inkStrong)).toBeInTheDocument()
  })
})
