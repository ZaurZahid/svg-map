import { RefObject, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as d3 from "d3";

export function useSelectElements(
  svgRef: RefObject<SVGSVGElement | null>,
  zoomBehavior: RefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Initialize selected IDs from URL
    const initialSelected = searchParams.get("ids")?.split(",") || [];
    selectedIds.current = new Set(initialSelected.filter(Boolean));

    if (selectedIds.current.size > 0 && svgRef.current && zoomBehavior.current) {
      zoomToSelectedElements();
    }
  }, [searchParams]);

  const calculateSVGBounds = () => {
    if (!svgRef.current) return null;

    // First try to get all elements with shop IDs
    const shopElements = svgRef.current.querySelectorAll('[id*="shop"]');
    console.log('Found shop elements:', shopElements.length);

    if (shopElements.length === 0) return null;

    // Calculate the bounds encompassing all shop elements
    const bounds = Array.from(shopElements).reduce((acc, element) => {
      const bbox = (element as SVGGraphicsElement).getBBox();
      console.log('Shop element bbox:', element.id, bbox);

      if (!acc) {
        return {
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height
        };
      }

      const minX = Math.min(acc.x, bbox.x);
      const minY = Math.min(acc.y, bbox.y);
      const maxX = Math.max(acc.x + acc.width, bbox.x + bbox.width);
      const maxY = Math.max(acc.y + acc.height, bbox.y + bbox.height);

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    }, null as null | { x: number; y: number; width: number; height: number });

    console.log('Calculated total bounds:', bounds);
    return bounds;
  };

  const zoomToSelectedElements = () => {
    if (!svgRef.current || !zoomBehavior.current) {
      console.log('SVG or zoom behavior not available');
      return;
    }

    const selectedElements = Array.from(selectedIds.current)
      .map(id => document.getElementById(id) as SVGGraphicsElement | null)
      .filter((el): el is SVGGraphicsElement => el !== null);

    console.log('Selected elements:', selectedElements.length, selectedElements);
    if (selectedElements.length === 0) return;

    // Get the overall SVG bounds for reference
    const svgBounds = calculateSVGBounds();
    if (!svgBounds) {
      console.log('Could not determine SVG bounds');
      return;
    }
    console.log('SVG bounds:', svgBounds);

    // Calculate bounds of selected elements
    const selectedBounds = selectedElements.reduce((acc, element) => {
      const bbox = element.getBBox();
      const ctm = element.getCTM();
      if (!ctm) return acc;

      // Transform the bbox coordinates
      const points = [
        { x: bbox.x, y: bbox.y },
        { x: bbox.x + bbox.width, y: bbox.y },
        { x: bbox.x, y: bbox.y + bbox.height },
        { x: bbox.x + bbox.width, y: bbox.y + bbox.height }
      ].map(point => {
        const transformed = svgRef.current!.createSVGPoint();
        transformed.x = point.x;
        transformed.y = point.y;
        const absolutePoint = transformed.matrixTransform(ctm);
        return absolutePoint;
      });

      // Find the extremes of the transformed points
      const minX = Math.min(...points.map(p => p.x));
      const minY = Math.min(...points.map(p => p.y));
      const maxX = Math.max(...points.map(p => p.x));
      const maxY = Math.max(...points.map(p => p.y));

      console.log('Element transformed bounds:', element.id, { minX, minY, maxX, maxY });

      if (!acc) {
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      }

      return {
        x: Math.min(acc.x, minX),
        y: Math.min(acc.y, minY),
        width: Math.max(acc.x + acc.width, maxX) - Math.min(acc.x, minX),
        height: Math.max(acc.y + acc.height, maxY) - Math.min(acc.y, minY)
      };
    }, null as null | { x: number; y: number; width: number; height: number });

    console.log('Selected bounds:', selectedBounds);
    if (!selectedBounds) return;

    // Get current SVG dimensions
    const svgWidth = svgRef.current.clientWidth;
    const svgHeight = svgRef.current.clientHeight;
    console.log('SVG dimensions:', { svgWidth, svgHeight });

    // Add padding (5% of the smaller dimension)
    const padding = Math.min(svgWidth, svgHeight) * 0.05;
    selectedBounds.x -= padding;
    selectedBounds.y -= padding;
    selectedBounds.width += padding * 2;
    selectedBounds.height += padding * 2;

    // Calculate scale to fit the selection
    const scaleX = svgWidth / selectedBounds.width;
    const scaleY = svgHeight / selectedBounds.height;
    const scale = Math.min(Math.min(scaleX, scaleY), 4);
    console.log('Scale factors:', { scaleX, scaleY, finalScale: scale });

    // Calculate the center point of the bounds
    const centerX = selectedBounds.x + selectedBounds.width / 2;
    const centerY = selectedBounds.y + selectedBounds.height / 2;
    console.log('Center point:', { centerX, centerY });

    // Create transform
    const transform = d3.zoomIdentity
      .translate(svgWidth / 2, svgHeight / 2)
      .scale(scale)
      .translate(-centerX, -centerY);

    console.log('Final transform:', transform);

    // Apply transform with transition
    d3.select(svgRef.current)
      .transition()
      .duration(750)
      .call(zoomBehavior.current.transform, transform);
  };

  useEffect(() => {
    // Selection and click handler setup
    const clickableElementsSelect = d3.selectAll<SVGElement, unknown>(
      "[id*='shop']",
    );

    console.log('Initial selection count:', selectedIds.current.size);

    clickableElementsSelect.each(function () {
      const element = d3.select(this);
      const id = this.id;
      element.classed("selected", selectedIds.current.has(id));
    });

    // Click handler for selectable elements
    clickableElementsSelect.on("click", function (event) {
      event.stopPropagation();
      const element = d3.select(this);
      const id = this.id;
      const isSelected = element.classed("selected");

      console.log('Element clicked:', { id, isSelected });

      if (selectedIds.current.size >= 100 && !isSelected) {
        console.log('Selection limit reached');
        return alert("You can only select up to 100 items at a time.");
      }

      if (!svgRef?.current || !zoomBehavior?.current) {
        console.log('SVG or zoom behavior not available');
        return;
      }

      // Toggle selection state
      element.classed("selected", !isSelected);

      // Update selected IDs
      if (!isSelected) {
        selectedIds.current.add(id);
      } else {
        selectedIds.current.delete(id);
      }

      console.log('Updated selection count:', selectedIds.current.size);

      const params = new URLSearchParams(searchParams.toString());
      const selectedString = Array.from(selectedIds.current).join(",");

      if (selectedIds.current.size > 0) {
        params.set("ids", selectedString);
      } else {
        params.delete("ids");
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });

      if (selectedIds.current.size > 0) {
        zoomToSelectedElements();
      }
    });
  }, [pathname, router, searchParams, svgRef, zoomBehavior]);

  return { selectedIds, zoomToSelectedElements };
}
