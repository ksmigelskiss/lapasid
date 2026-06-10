import { Component } from 'react'
import { RefreshCw } from 'lucide-react'
import { reportError } from '../utils/sentry.js'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
    reportError(error, { componentStack: info.componentStack })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-app px-8 text-center gap-5">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <RefreshCw size={24} className="text-red-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">Kažkas nutiko</p>
            <p className="text-sm text-gray-400 mt-1 leading-snug">
              {this.state.error.message ?? 'Netikėta klaida'}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gray-800 text-white rounded-2xl text-sm font-medium"
          >
            Perkrauti
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
