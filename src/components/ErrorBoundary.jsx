// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { Component } from 'react';
import ErrorModal from './ErrorModal';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught an error:', error, info.componentStack);
    }

    componentDidMount() {
        this.errorHandler = (event) => {
            if (!this.state.hasError) {
                this.setState({ hasError: true, error: event.error || event.message });
            }
            event.preventDefault();
        };

        this.unhandledRejectionHandler = (event) => {
            if (!this.state.hasError) {
                this.setState({ hasError: true, error: event.reason });
            }
            event.preventDefault();
        };

        window.addEventListener('error', this.errorHandler);
        window.addEventListener('unhandledrejection', this.unhandledRejectionHandler);
    }

    componentWillUnmount() {
        window.removeEventListener('error', this.errorHandler);
        window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler);
    }

    handleGoHome = () => {
        window.location.href = window.location.pathname;
    };

    render() {
        if (this.state.hasError) {
            return (
                <ErrorModal
                    isOpen={true}
                    onGoHome={this.handleGoHome}
                />
            );
        }

        return this.props.children;
    }
}
