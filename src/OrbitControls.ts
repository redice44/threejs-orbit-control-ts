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

// Out of scope internals
let state: STATE;

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

  }

  private setupHandlers() {
    this.domElement.addEventListener( 'contextmenu', onContextMenu, false );

    this.domElement.addEventListener( 'mousedown', onMouseDown, false );
    this.domElement.addEventListener( 'wheel', onMouseWheel, false );

    this.domElement.addEventListener( 'touchstart', onTouchStart, false );
    this.domElement.addEventListener( 'touchend', onTouchEnd, false );
    this.domElement.addEventListener( 'touchmove', onTouchMove, false );

    window.addEventListener( 'keydown', onKeyDown, false );
  }

  getPolarAngle() {

  }

  getAzimuthalAngle() {

  }

  saveState() {

    this.target0.copy( this.target );
    this.position0.copy( this.object.position );
    this.zoom0 = this.object.zoom;

  }

  reset() {

    this.target.copy( this.target0 );
    this.object.position.copy( this.position0 );
    this.object.zoom = this.zoom0;

    this.object.updateProjectionMatrix();
    this.dispatchEvent( { type: Events.change } );

    this.update();

    state = STATE.NONE;
  }

  update() {

  }

  dispose() {

  }

}



function getAutoRotationAngle() {

}

function getZoomScale() {

}

function rotateLeft(angle) {

}

function rotateUp(angle) {

}

function panLeft() {

}

function panUp() {

}

function pan() {

}

function dollyIn(dollyScale) {

}

function dollyOut(dollyScale) {

}

function handleMouseDownRotate(event) {

}

function handleMouseDownDolly(event) {

}

function handleMouseDownPan(event) {

}

function handleMouseMoveRotate(event) {

}

function handleMouseMoveDolly(event) {

}

function handleMouseMovePan(event) {

}

function handleMouseUp(event) {

}

function handleMouseWheel(event) {

}

function handleKeyDown(event) {

}

function handleTouchStartRotate(event) {

}

function handleTouchStartDolly(event) {

}

function handleTouchStartPan(event) {

}

function handleTouchMoveRotate(event) {

}

function handleTouchMoveDolly(event) {

}

function handleTouchMovePan(event) {

}

function handleTouchEnd(event) {

}

function onMouseDown(event) {

}

function onMouseMove(event) {

}

function onMouseUp(event) {

}

function onMouseWheel(event) {

}

function onKeyDown(event) {

}

function onTouchStart(event) {

}

function onTouchMove(event) {

}

function onTouchEnd(event) {

}

function onContextMenu(event) {

}
