import { useLayoutEffect } from 'react';

export const useFlatGridDividers = (isFlatMode: boolean, deps: unknown[] = []) => {
    useLayoutEffect(() => {
        const cleanup = () => {
            document
                .querySelectorAll('[data-flat-grid] > [data-flat-right], [data-flat-grid] > [data-flat-long], [data-flat-grid] > [data-flat-in-grid], [data-flat-row-divider]')
                .forEach((node) => {
                    node.removeAttribute('data-flat-right');
                    node.removeAttribute('data-flat-long');
                    node.removeAttribute('data-flat-in-grid');
                    if (node.hasAttribute('data-flat-row-divider')) {
                        node.remove();
                    }
                });
        };

        if (!isFlatMode) {
            cleanup();
            return;
        }

        let frame = 0;
        const rowTolerance = 6;
        const minVisibleSize = 2;

        const updateGridLines = () => {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const grids = Array.from(document.querySelectorAll<HTMLElement>('[data-flat-grid]'));
                if (grids.length === 0) return;
                grids.forEach((grid) => {
                    const allChildren = Array.from(grid.children).filter(
                        (child): child is HTMLElement => child instanceof HTMLElement
                    );
                    const children = allChildren.filter((child) => !child.hasAttribute('data-flat-ignore'));

                    grid.querySelectorAll('[data-flat-row-divider]').forEach((node) => node.remove());

                    allChildren.forEach((child) => {
                        child.removeAttribute('data-flat-right');
                        child.removeAttribute('data-flat-long');
                        child.removeAttribute('data-flat-in-grid');
                    });

                    const gridRect = grid.getBoundingClientRect();
                    if (!gridRect.width) return;
                    const gridStyles = window.getComputedStyle(grid);
                    const rowGapValue = gridStyles.rowGap || gridStyles.gap || '0';
                    const columnGapValue = gridStyles.columnGap || gridStyles.gap || '0';
                    const rowGapPx = Number.parseFloat(rowGapValue) || 0;
                    const columnGapPx = Number.parseFloat(columnGapValue) || 0;
                    const halfRowGap = rowGapPx / 2;
                    if (columnGapPx > 0) {
                        grid.style.setProperty('--flat-divider-col-gap', `${columnGapPx}px`);
                    }
                    if (rowGapPx > 0) {
                        grid.style.setProperty('--flat-divider-row-gap', `${rowGapPx}px`);
                    }

                    const rows: Array<{ top: number; items: Array<{ el: HTMLElement; rect: DOMRect }> }> = [];

                    children.forEach((child) => {
                        const rect = child.getBoundingClientRect();
                        if (rect.width < minVisibleSize || rect.height < minVisibleSize) return;
                        const top = rect.top - gridRect.top;
                        let row = rows.find((entry) => Math.abs(entry.top - top) <= rowTolerance);
                        if (!row) {
                            row = { top, items: [] };
                            rows.push(row);
                        }
                        row.items.push({ el: child, rect });
                    });

                    rows.sort((a, b) => a.top - b.top);
                    const fullWidthThreshold = gridRect.width - 8;

                    rows.forEach((row, rowIndex) => {
                        row.items.sort((a, b) => a.rect.left - b.rect.left);

                        const hasTopMarker = row.items.some(({ el }) => el.hasAttribute('data-flat-top'));
                        if (hasTopMarker && rowIndex > 0) {
                            const line = document.createElement('div');
                            line.setAttribute('data-flat-row-divider', 'true');
                            line.style.top = `${row.top - halfRowGap}px`;
                            grid.appendChild(line);
                        }

                        if (row.items.length > 1) {
                            row.items.slice(0, -1).forEach(({ el }) => {
                                el.setAttribute('data-flat-right', 'true');
                            });
                        } else {
                            const only = row.items[0];
                            if (!only) return;
                            const isFullWidth = only.rect.width >= fullWidthThreshold;
                            if (isFullWidth && rowIndex < rows.length - 1) {
                                only.el.setAttribute('data-flat-long', 'true');
                            }
                        }

                        row.items.forEach(({ el }) => {
                            el.setAttribute('data-flat-in-grid', 'true');
                        });
                    });
                });
            });
        };

        updateGridLines();

        const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateGridLines) : null;
        document.querySelectorAll<HTMLElement>('[data-flat-grid]').forEach((grid) => resizeObserver?.observe(grid));
        window.addEventListener('resize', updateGridLines);

        return () => {
            if (frame) cancelAnimationFrame(frame);
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updateGridLines);
            cleanup();
        };
    }, [isFlatMode, ...deps]);
};
