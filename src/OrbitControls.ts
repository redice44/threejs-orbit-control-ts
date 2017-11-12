/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author erich666 / http://erichaines.com
 * @author redice44 / https://github.com/redice44
 */

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one finger move
//    Zoom - middle mouse, or mousewheel / touch: two finger spread or squish
//    Pan - right mouse, or arrow keys / touch: three finger swipe

import * as THREE from 'three';

interface ArrowKeys {
  LEFT: number,
  UP: number,
  RIGHT: number,
  BOTTOM: number
}

interface MouseButtons {
  ORBIT: THREE.MOUSE,
  ZOOM: THREE.MOUSE,
  PAN: THREE.MOUSE
}

enum STATE {
  NONE = -1,
  ROTATE,
  DOLLY,
  PAN,
  TOUCH_ROTATE,
  TOUCH_DOLLY,
  TOUCH_PAN
}

enum Events {
  change = 'change',
  start = 'start',
  end = 'end'
}

export default class OrbitControls extends THREE.EventDispatcher {
  // Set to false to disable this control
  public enabled: boolean;

  // "target" sets the location of focus, where the object orbits around
  public target: THREE.Vector3;

  // How far you can dolly in and out ( PerspectiveCamera only )
  public minDistance: number;
  public maxDistance: number;

  // How far you can zoom in and out ( OrthographicCamera only )
  public minZoom: number;
  public maxZoom: number;

  // How far you can orbit vertically, upper and lower limits.
  // Range is 0 to Math.PI radians.
  public minPolarAngle: number; // radians
  public maxPolarAngle: number; // radians

  // How far you can orbit horizontally, upper and lower limits.
  // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
  public minAzimuthAngle: number; // radians
  public maxAzimuthAngle: number ; // radians

  // Set to true to enable damping (inertia)
  // If damping is enabled, you must call controls.update() in your animation loop
  public enableDamping: boolean;
  public dampingFactor: number;

  // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
  // Set to false to disable zooming
  public enableZoom: boolean;
  public zoomSpeed: number;

  // Set to false to disable rotating
  public enableRotate: boolean;
  public rotateSpeed: number;

  // Set to false to disable panning
  public enablePan: boolean;
  public keyPanSpeed: number;  // pixels moved per arrow key push

  // Set to true to automatically rotate around the target
  // If auto-rotate is enabled, you must call controls.update() in your animation loop
  public autoRotate: boolean;
  public autoRotateSpeed: number; // 30 seconds per round when fps is 60

  // Set to false to disable use of the keys
  public enableKeys: boolean;

  // The four arrow keys
  public keys: ArrowKeys;

  // Mouse buttons
  public mouseButtons: MouseButtons;

  private object: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private domElement: Document | Element;

  // for reset
  private target0: THREE.Vector3;
  private position0: THREE.Vector3;
  private zoom0: number;

  private state: STATE;
  private EPS: number;

  // current position in spherical coordinates
  private spherical: THREE.Spherical;
  private sphericalDelta: THREE.Spherical;

  private scale: number;
  private panOffset: THREE.Vector3;
  private zoomChanged: boolean;

  private rotateStart: THREE.Vector2;
  private rotateEnd: THREE.Vector2;
  private rotateDelta: THREE.Vector2;

  private panStart: THREE.Vector2;
  private panEnd: THREE.Vector2;
  private panDelta: THREE.Vector2;

  private dollyStart: THREE.Vector2;
  private dollyEnd: THREE.Vector2;
  private dollyDelta: THREE.Vector2;

  constructor( object: THREE.PerspectiveCamera | THREE.OrthographicCamera, domElement: Document | Element = document ) {

    super();

    this.object = object;
    this.domElement = domElement;

    // Default Settings
    this.setupDefaults();

    this.setupHandlers();
    this.update();

  }

  private setupDefaults() {

    // Set to false to disable this control
    this.enabled = true;

    // "target" sets the location of focus, where the object orbits around
    this.target = new THREE.Vector3()

    // How far you can dolly in and out ( PerspectiveCamera only )
    this.minDistance = 0;
    this.maxDistance = Infinity;

    // How far you can zoom in and out ( OrthographicCamera only )
    this.minZoom = 0;
    this.maxZoom = Infinity;

    // How far you can orbit vertically, upper and lower limits.
    // Range is 0 to Math.PI radians.
    this.minPolarAngle = 0; // radians
    this.maxPolarAngle = Math.PI; // radians

    // How far you can orbit horizontally, upper and lower limits.
    // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
    this.minAzimuthAngle = - Infinity; // radians
    this.maxAzimuthAngle = Infinity; // radians

    // Set to true to enable damping (inertia)
    // If damping is enabled, you must call controls.update() in your animation loop
    this.enableDamping = false;
    this.dampingFactor = 0.25;

    // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
    // Set to false to disable zooming
    this.enableZoom = true;
    this.zoomSpeed = 1.0;

    // Set to false to disable rotating
    this.enableRotate = true;
    this.rotateSpeed = 1.0;

    // Set to false to disable panning
    this.enablePan = true;
    this.keyPanSpeed = 7.0;  // pixels moved per arrow key push

    // Set to true to automatically rotate around the target
    // If auto-rotate is enabled, you must call controls.update() in your animation loop
    this.autoRotate = false;
    this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

    // Set to false to disable use of the keys
    this.enableKeys = true;

    // The four arrow keys
    this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

    // Mouse buttons
    this.mouseButtons = { ORBIT: THREE.MOUSE.LEFT, ZOOM: THREE.MOUSE.MIDDLE, PAN: THREE.MOUSE.RIGHT };

    this.state = STATE.NONE;

    this.EPS = 0.000001;

    // current position in spherical coordinates
    this.spherical = new THREE.Spherical();
    this.sphericalDelta = new THREE.Spherical();

    this.scale = 1;
    this.panOffset = new THREE.Vector3();
    this.zoomChanged = false;

    this.rotateStart = new THREE.Vector2();
    this.rotateEnd = new THREE.Vector2();
    this.rotateDelta = new THREE.Vector2();

    this.panStart = new THREE.Vector2();
    this.panEnd = new THREE.Vector2();
    this.panDelta = new THREE.Vector2();

    this.dollyStart = new THREE.Vector2();
    this.dollyEnd = new THREE.Vector2();
    this.dollyDelta = new THREE.Vector2();

  }

  private setupHandlers() {

    this.domElement.addEventListener( 'contextmenu', this.onContextMenu, false );

    this.domElement.addEventListener( 'mousedown', this.onMouseDown, false );
    this.domElement.addEventListener( 'wheel', this.onMouseWheel, false );

    this.domElement.addEventListener( 'touchstart', this.onTouchStart, false );
    this.domElement.addEventListener( 'touchend', this.onTouchEnd, false );
    this.domElement.addEventListener( 'touchmove', this.onTouchMove, false );

    window.addEventListener( 'keydown', this.onKeyDown, false );

  }

  public getPolarAngle() {

  }

  public getAzimuthalAngle() {

  }

  public saveState() {

    this.target0.copy( this.target );
    this.position0.copy( this.object.position );
    this.zoom0 = this.object.zoom;

  }

  public reset() {

    this.target.copy( this.target0 );
    this.object.position.copy( this.position0 );
    this.object.zoom = this.zoom0;

    this.object.updateProjectionMatrix();
    this.dispatchEvent( { type: Events.change } );

    this.update();

  }

  // this method is exposed, but perhaps it would be better if we can make it private...
  public update(): boolean {

    const offset: THREE.Vector3 = new THREE.Vector3();

    // so camera.up is the orbit axis
    const quat: THREE.Quaternion = new THREE.Quaternion().setFromUnitVectors( this.object.up, new THREE.Vector3( 0, 1, 0 ) );
    const quatInverse: THREE.Quaternion = quat.clone().inverse();

    const lastPosition: THREE.Vector3 = new THREE.Vector3();
    const lastQuaternion: THREE.Quaternion = new THREE.Quaternion();

    // fn?

    const position: THREE.Vector3 = this.object.position;

    offset.copy( position ).sub( this.target );

    // rotate offset to "y-axis-is-up" space
    offset.applyQuaternion( quat );

    // angle from z-axis around y-axis
    this.spherical.setFromVector3( offset );

    if ( this.autoRotate && this.state === STATE.NONE ) {

      this.rotateLeft( this.getAutoRotationAngle() );

    }

    this.spherical.theta += this.sphericalDelta.theta;
    this.spherical.phi += this.sphericalDelta.phi;

    // restrict theta to be between desired limits
    this.spherical.theta = Math.max( this.minAzimuthAngle, Math.min( this.maxAzimuthAngle, this.spherical.theta ) );

    // restrict phi to be between desired limits
    this.spherical.phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, this.spherical.phi ) );

    this.spherical.makeSafe();

    this.spherical.radius *= this.scale;

    // restrict radius to be between desired limits
    this.spherical.radius = Math.max( this.minDistance, Math.min( this.maxDistance, this.spherical.radius ) );

    // move target to panned location
    this.target.add( this.panOffset );

    offset.setFromSpherical( this.spherical );

    // rotate offset back to "camera-up-vector-is-up" space
    offset.applyQuaternion( quatInverse );

    position.copy( this.target ).add( offset );

    this.object.lookAt( this.target );

    if ( this.enableDamping === true ) {

      this.sphericalDelta.theta *= ( 1 - this.dampingFactor );
      this.sphericalDelta.phi *= ( 1 - this.dampingFactor );

    } else {

      this.sphericalDelta.set( 0, 0, 0);

    }

    this.scale = 1;
    this.panOffset.set( 0, 0, 0 );

    // update condition is:
    // min(camera displacement, camera rotation in radians)^2 > EPS
    // using small-angle approximation cos(x/2) = 1 - x^2 / 8

    if ( this.zoomChanged ||
      lastPosition.distanceToSquared( this.object.position ) > this.EPS ||
      8 * ( 1 - lastQuaternion.dot( this.object.quaternion ) ) > this.EPS ) {

      this.dispatchEvent( { type: Events.change } );

      lastPosition.copy( this.object.position );
      lastQuaternion.copy( this.object.quaternion );
      this.zoomChanged = false;

      return true;

    }

    return false;
  }

  public dispose() {

    this.domElement.removeEventListener( 'contextmenu', this.onContextMenu, false );
    this.domElement.removeEventListener( 'mousedown', this.onMouseDown, false );
    this.domElement.removeEventListener( 'wheel', this.onMouseWheel, false );

    this.domElement.removeEventListener( 'touchstart', this.onTouchStart, false );
    this.domElement.removeEventListener( 'touchend', this.onTouchEnd, false );
    this.domElement.removeEventListener( 'touchmove', this.onTouchMove, false );

    document.removeEventListener( 'mousemove', this.onMouseMove, false );
    document.removeEventListener( 'mouseup', this.onMouseUp, false );

    window.removeEventListener( 'keydown', this.onKeyDown, false );

  }

  private getAutoRotationAngle() {

  }

  private getZoomScale() {

  }

  private rotateLeft(angle) {

  }

  private rotateUp(angle) {

  }

  private panLeft() {

  }

  private panUp() {

  }

  private pan() {

  }

  private dollyIn( dollyScale ) {

  }

  private dollyOut( dollyScale ) {

  }

  private handleMouseDownRotate( event ) {

  }

  private handleMouseDownDolly( event ) {

  }

  private handleMouseDownPan( event ) {

  }

  private handleMouseMoveRotate( event ) {

  }

  private handleMouseMoveDolly( event ) {

  }

  private handleMouseMovePan( event ) {

  }

  private handleMouseUp( event ) {

  }

  private handleMouseWheel( event ) {

  }

  private handleKeyDown( event ) {

  }

  private handleTouchStartRotate( event ) {

  }

  private handleTouchStartDolly( event ) {

  }

  private handleTouchStartPan( event ) {

  }

  private handleTouchMoveRotate( event ) {

  }

  private handleTouchMoveDolly( event ) {

  }

  private handleTouchMovePan( event ) {

  }

  private handleTouchEnd( event ) {

  }

  private onMouseDown( event ) {

  }

  private onMouseMove( event ) {

  }

  private onMouseUp( event ) {

  }

  private onMouseWheel( event ) {

  }

  private onKeyDown( event ) {

  }

  private onTouchStart( event ) {

  }

  private onTouchMove( event ) {

  }

  private onTouchEnd( event ) {

  }

  private onContextMenu( event ) {

  }

}
