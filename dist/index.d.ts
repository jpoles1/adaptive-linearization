export declare type IteratorConsumer = (x1: number, y1: number, x2: number, y2: number, index: number, svgcmd: any[]) => void;
export interface LinearizationOpts {
    approximationScale: number;
    curve_distance_epsilon: number;
    curveColinearityEpsilon: number;
    curveAngleToleranceEpsilon: number;
    angleTolerance: number;
    recursionLimit: number;
    cuspLimit: number;
}
export declare class AdaptiveLinearization {
    consumer: IteratorConsumer;
    opts: LinearizationOpts;
    prevX: number;
    prevY: number;
    constructor(consumer: IteratorConsumer, opts: any);
    /**
     * Higher level helper function to linearize full svg-paths. Supposed to be called by the iterate function
     * of the svgpath library. (NPM "svgpath").
     *
     * @param segment   segment array
     * @param index     index
     * @param curX      current x-coordinate
     * @param curY      current y-coordinate
     */
    svgPathIterator: (segment: any[], index: number, curX: number, curY: number) => void;
    /**
     * Core linearization function linearizes the given bezier curve. Calls the line consumer function registered for
     * the current instance once for every line segment of the linearized curve.
     *
     * @param x1        {number} x-coordinate of the start point
     * @param y1        {number} y-coordinate of the start point
     * @param x2        {number} x-coordinate of the first control point
     * @param y2        {number} y-coordinate of the first control point
     * @param x3        {number} x-coordinate of the second control point
     * @param y3        {number} y-coordinate of the second control point
     * @param x4        {number} x-coordinate of the end point
     * @param y4        {number} y-coordinate of the start point
     * @param [data]    {*} user data passed on to the comsumer function
     */
    linearize(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, data: any): void;
    distanceTo(x1: number, y1: number, x2: number, y2: number): number;
    linearizeRecursive(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, data: any, level: number): void;
}
