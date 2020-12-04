var PI = Math.PI;
var TAU = PI*2;

export type IteratorConsumer = (x1: number, y1: number, x2: number, y2: number, index: number, svgcmd: any[]) => void

export interface LinearizationOpts {
    // Approximation scale: Higher is better quality
    approximationScale: number
    // Limit to disregard the curve distance at
    curve_distance_epsilon: number
    // Limit to disregard colinearity at
    curveColinearityEpsilon: number
    // Limit disregard angle tolerance
    curveAngleToleranceEpsilon:  number
    // Angle tolerance, higher is better quality
    angleTolerance: number
    // Hard recursion subdivision limit
    recursionLimit: number
    // Limit for curve cusps: 0 = off (range: 0 to pi)
    cuspLimit: number
}

const DEFAULT_OPTS: LinearizationOpts = {
    approximationScale: 1,
    curve_distance_epsilon: 1e-30,
    curveColinearityEpsilon: 1e-30,
    curveAngleToleranceEpsilon:  0.01,
    angleTolerance: 0.4,
    recursionLimit: 32,
    cuspLimit: 0
};

export class AdaptiveLinearization {
    consumer: IteratorConsumer
    opts: LinearizationOpts
    prevX: number
    prevY: number
    constructor(consumer: IteratorConsumer, opts: any) {
        this.consumer = (x1, y1, x2, y2, data, svgcmd) => {
            consumer(x1, y1, x2, y2, data, svgcmd);
            this.prevX = x2;
            this.prevY = y2;
        };
        this.opts = Object.assign({}, DEFAULT_OPTS, opts);
        this.prevX = 0;
        this.prevY = 0;
    }
    /**
     * Higher level helper function to linearize full svg-paths. Supposed to be called by the iterate function
     * of the svgpath library. (NPM "svgpath").
     *
     * @param segment   segment array
     * @param index     index
     * @param curX      current x-coordinate
     * @param curY      current y-coordinate
     */
    public svgPathIterator = (segment: any[], index: number, curX: number, curY: number) => {
        var command = segment[0];

        var i, x, y, x2, y2, x3, y3, x4, y4, short = false;
        switch (command) {
            case "M":
                for (i = 1; i < segment.length; i += 2) {
                    x = segment[i];
                    y = segment[i + 1];
                    this.consumer(curX, curY, x, y, index, ["M", x, y]);
                    curX = x;
                    curY = y;
                }
                break;
            case "L":
                for (i = 1; i < segment.length; i += 2) {
                    x = segment[i];
                    y = segment[i + 1];
                    this.consumer(curX, curY, x, y, index, ["L", x, y]);
                    curX = x;
                    curY = y;
                }
                break;
            case "H":
                y = curY
                for (i = 1; i < segment.length; i += 2) {
                    x = segment[i];
                    this.consumer(curX, curY, x, y, index, ["H", x]);
                    curX = x;
                }
                break;
            case "V":
                x = curX
                for (i = 1; i < segment.length; i += 2) {
                    y = segment[i];
                    this.consumer(curX, curY, x, y, index, ["V", y]);
                    curY = y;
                }
                break;
            case "Z":
                this.consumer(curX, curY, curX, curY, index, ["Z"]);
                break;
            case "Q":
                short = true;
            // intentional fallthrough
            case "C":
                //console.log("C segment", segment);
                var step = short ? 4 : 6;

                for (i = 1; i < segment.length; i += step)
                {
                    x = curX;
                    y = curY;
                    x2 = segment[i];
                    y2 = segment[i + 1];
                    x3 = short ? x2 : segment[i + 2];
                    y3 = short ? y2 : segment[i + 3];
                    x4 = short ? segment[i + 2] : segment[i + 4];
                    y4 = short ? segment[i + 3] : segment[i + 5];

                    this.linearize(
                        x,y,
                        x2,y2,
                        x3,y3,
                        x4,y4,
                        index
                    );

                    curX = x;
                    curY = y;
                }
                break;
            default:
                throw new Error("path command '" + command + "' not supported yet");

        }
    }
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
    linearize(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, data: any) {
        this.linearizeRecursive(x1, y1, x2, y2, x3, y3, x4, y4, data, 0);

        const prevX = this.prevX;
        const prevY = this.prevY;

        if (prevX !== x4 || prevY !== y4) {
            this.consumer(prevX, prevY, x4, y4, data, ["L", x4, y4]);
        }
    }
    distanceTo(x1: number, y1: number, x2: number, y2: number): number {
        var x = x2 - x1;
        var y = y2 - y1;
    
        return Math.sqrt(x*x+y*y);
    }    
    linearizeRecursive(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, data: any, level: number) {
        const cuspLimit = this.opts.cuspLimit;
        const curveColinearityEpsilon = this.opts.curveColinearityEpsilon;
        const curveAngleToleranceEpsilon = this.opts.curveAngleToleranceEpsilon;
        const angleTolerance = this.opts.angleTolerance;
        const distanceToleranceSquared = (0.5 / this.opts.approximationScale)**2;
    
        ///////////////////////////////
        // Calculate all the mid-points of the line segments
        //----------------------
        var x12   = (x1 + x2) / 2;
        var y12   = (y1 + y2) / 2;
        var x23   = (x2 + x3) / 2;
        var y23   = (y2 + y3) / 2;
        var x34   = (x3 + x4) / 2;
        var y34   = (y3 + y4) / 2;
        var x123  = (x12 + x23) / 2;
        var y123  = (y12 + y23) / 2;
        var x234  = (x23 + x34) / 2;
        var y234  = (y23 + y34) / 2;
        var x1234 = (x123 + x234) / 2;
        var y1234 = (y123 + y234) / 2;
    
    
        // Try to approximate the full cubic curve by a single straight line
        //------------------
        var dx = x4 - x1;
        var dy = y4 - y1;
    
        var d2 = Math.abs(((x2 - x4) * dy - (y2 - y4) * dx));
        var d3 = Math.abs(((x3 - x4) * dy - (y3 - y4) * dx));
        var da1, da2, k;
    
        switch(
        (d2 > curveColinearityEpsilon ? 2 : 0) +
        (d3 > curveColinearityEpsilon? 1 : 0)
            )
        {
            case 0:
                // All collinear OR p1==p4
                //----------------------
                k = dx*dx + dy*dy;
                if(k === 0)
                {
                    d2 = this.distanceTo(x1, y1, x2, y2);
                    d3 = this.distanceTo(x4, y4, x3, y3);
                }
                else
                {
                    k   = 1 / k;
                    da1 = x2 - x1;
                    da2 = y2 - y1;
                    d2  = k * (da1*dx + da2*dy);
                    da1 = x3 - x1;
                    da2 = y3 - y1;
                    d3  = k * (da1*dx + da2*dy);
                    if(d2 > 0 && d2 < 1 && d3 > 0 && d3 < 1)
                    {
                        // Simple collinear case, 1---2---3---4
                        // We can leave just two endpoints
                        this.consumer(x1,y1,x4,y4, data, ["L", x4, y4]);
                        return;
                    }
                    if(d2 <= 0) d2 = this.distanceTo(x2, y2, x1, y1);
                    else if(d2 >= 1) d2 = this.distanceTo(x2, y2, x4, y4);
                    else             d2 = this.distanceTo(x2, y2, x1 + d2*dx, y1 + d2*dy);
    
                    if(d3 <= 0) d3 = this.distanceTo(x3, y3, x1, y1);
                    else if(d3 >= 1) d3 = this.distanceTo(x3, y3, x4, y4);
                    else             d3 = this.distanceTo(x3, y3, x1 + d3*dx, y1 + d3*dy);
                }
                if(d2 > d3)
                {
                    if(d2 < distanceToleranceSquared)
                    {
                        this.consumer(x1,y1,x2,y2, data, ["L", x2, y2]);
                        return;
                    }
                }
                else
                {
                    if(d3 < distanceToleranceSquared)
                    {
                        this.consumer(x1,y1, x3, y3, data, ["L", x3, y3]);
                        return;
                    }
                }
                break;
    
            case 1:
                // p1,p2,p4 are collinear, p3 is significant
                //----------------------
                if(d3 * d3 <= distanceToleranceSquared * (dx*dx + dy*dy))
                {
                    if(angleTolerance < curveAngleToleranceEpsilon)
                    {
                        this.consumer(x1,y1,x23,y23, data, ["L", x23, y23]);
                        return;
                    }
    
                    // Angle Condition
                    //----------------------
                    da1 = Math.abs(Math.atan2(y4 - y3, x4 - x3) - Math.atan2(y3 - y2, x3 - x2));
                    if(da1 >= PI) da1 = TAU - da1;
    
                    if(da1 < angleTolerance)
                    {
                        this.consumer(x1,y1,x2,y2, data, ["L", x2, y2]);
                        this.consumer(x2,y2,x3,y3, data, ["L", x3, y3]);
                        return;
                    }
    
                    if(cuspLimit !== 0.0)
                    {
                        if(da1 > PI - cuspLimit)
                        {
                            this.consumer(x1,y1,x3,y3, data, ["L", x3, y3]);
                            return;
                        }
                    }
                }
                break;
    
            case 2:
                // p1,p3,p4 are collinear, p2 is significant
                //----------------------
                if(d2 * d2 <= distanceToleranceSquared * (dx*dx + dy*dy))
                {
                    if(angleTolerance < curveAngleToleranceEpsilon)
                    {
                        this.consumer(x1,y1,x23,y23, data, ["L", x23, y23]);
                        return;
                    }
    
                    // Angle Condition
                    //----------------------
                    da1 = Math.abs(Math.atan2(y3 - y2, x3 - x2) - Math.atan2(y2 - y1, x2 - x1));
                    if(da1 >= PI) da1 = TAU - da1;
    
                    if(da1 < angleTolerance)
                    {
                        this.consumer(x1,y1,x2,y2, data, ["L", x2, y2]);
                        this.consumer(x2,y2,x3,y3, data, ["L", x3, y3]);
                        return;
                    }
    
                    if(cuspLimit !== 0.0)
                    {
                        if(da1 > PI - cuspLimit)
                        {
                            this.consumer(x1,y1,x2,y2, data, ["L", x2, y2]);
                            return;
                        }
                    }
                }
                break;
    
            case 3:
                // Regular case
                //-----------------
                if((d2 + d3)*(d2 + d3) <= distanceToleranceSquared * (dx*dx + dy*dy))
                {
                    // If the curvature doesn't exceed the distance_tolerance value
                    // we tend to finish subdivisions.
                    //----------------------
                    if(angleTolerance < curveAngleToleranceEpsilon)
                    {
                        this.consumer(x1,y1,x23,y23, data, ["L", x23, y23]);
                        return;
                    }
    
                    // Angle & Cusp Condition
                    //----------------------
                    k   = Math.atan2(y3 - y2, x3 - x2);
                    da1 = Math.abs(k - Math.atan2(y2 - y1, x2 - x1));
                    da2 = Math.abs(Math.atan2(y4 - y3, x4 - x3) - k);
                    if(da1 >= PI) da1 = TAU - da1;
                    if(da2 >= PI) da2 = TAU - da2;
    
                    if(da1 + da2 < angleTolerance)
                    {
                        this.consumer(x1,y1,x23,y23, data, ["L", x23, y23]);
                        return;
                    }
    
                    if(cuspLimit !== 0.0)
                    {
                        if(da1 > PI - cuspLimit)
                        {
                            this.consumer(x1,y1,x2,y2, data, ["L", x2, y2]);
                            return;
                        }
    
                        if(da2 > PI - cuspLimit)
                        {
                            this.consumer(x1,y1,x3,y3, data, ["L", x3, y3]);
                            return;
                        }
                    }
                }
                break;
        }
    
        var nextLevel = level + 1;
    
        if (nextLevel >= this.opts.recursionLimit)
        {
            this.consumer(x1, y1, x4, y4, data, ["L", x4, y4]);
            return;
        }
    
        // Continue subdivision
        //----------------------
        this.linearizeRecursive(x1, y1, x12, y12, x123, y123, x1234, y1234, data, nextLevel);
        this.linearizeRecursive(x1234, y1234, x234, y234, x34, y34, x4, y4, data, nextLevel);
    }
}