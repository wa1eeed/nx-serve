'use client';
import type { ReactNode } from 'react';
import { useT } from '../lib/i18n';
import type { ApiError } from '../lib/api';

export function PageHeader({ title, intro }: { title: string; intro?: string }): ReactNode {
  return (
    <header style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 26, margin: '0 0 8px' }}>{title}</h1>
      {intro ? <p style={{ color: 'var(--nx-color-muted-foreground)', margin: 0 }}>{intro}</p> : null}
    </header>
  );
}

export function Loading(): ReactNode {
  const t = useT();
  return <p style={{ color: 'var(--nx-color-muted-foreground)' }}>{t('common.loading')}</p>;
}

/** Explains an API failure honestly: auth needed vs API unreachable, with a retry. */
export function ErrorState({ error, onRetry }: { error: ApiError | Error; onRetry?: () => void }): ReactNode {
  const t = useT();
  const status = (error as ApiError).status;
  const message = status === 401 || status === 403 ? t('error.auth') : t('error.api');
  return (
    <div
      style={{
        border: '1px solid var(--nx-color-border)',
        borderRadius: 'var(--nx-radius-md)',
        padding: 16,
        background: 'var(--nx-color-card)',
      }}
    >
      <p style={{ margin: '0 0 12px' }}>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '7px 14px',
            borderRadius: 'var(--nx-radius-md)',
            border: '1px solid var(--nx-color-border)',
            background: 'transparent',
            color: 'var(--nx-color-foreground)',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          {t('common.retry')}
        </button>
      ) : null}
    </div>
  );
}
