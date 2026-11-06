import { Button as AntButton } from 'antd'
import type { ButtonProps as AntButtonProps } from 'antd'
import { clsx } from 'clsx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'dark' | 'coral'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<AntButtonProps, 'variant' | 'size' | 'type' | 'danger'> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const sizeMap: Record<ButtonSize, AntButtonProps['size']> = {
  sm: 'small',
  md: 'middle',
  lg: 'large',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  style,
  children,
  ...props
}: ButtonProps) {
  const antProps: AntButtonProps = { size: sizeMap[size] }

  switch (variant) {
    case 'primary':
      antProps.color = 'primary'
      antProps.variant = 'solid'
      break
    case 'coral':
      antProps.className = clsx('btn-coral', className)
      return (
        <AntButton
          size={sizeMap[size]}
          style={style}
          {...props}
          className={clsx('btn-coral font-[var(--font-ui)]', className)}
        >
          {children}
        </AntButton>
      )
    case 'secondary':
      antProps.color = 'primary'
      antProps.variant = 'outlined'
      break
    case 'ghost':
      antProps.color = 'default'
      antProps.variant = 'text'
      break
    case 'destructive':
      antProps.color = 'danger'
      antProps.variant = 'solid'
      break
    case 'dark':
      antProps.variant = 'solid'
      antProps.style = {
        backgroundColor: 'var(--color-text)',
        borderColor: 'var(--color-text)',
        color: '#fff',
        ...style,
      }
      break
  }

  if (variant !== 'dark') antProps.style = style

  return (
    <AntButton className={clsx('font-[var(--font-ui)]', className)} {...antProps} {...props}>
      {children}
    </AntButton>
  )
}
